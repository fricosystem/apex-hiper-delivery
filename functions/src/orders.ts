import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import {
  createOrderInputSchema,
  deliveryFeeCents,
  describeLineProblem,
  estimateRoadKm,
  isOpenAt,
  isTenantSelling,
  orderPaths,
  paths,
  priceLine,
  tenantOperationSchema,
  type CatalogItem,
  type LatLng,
  type Order,
  type OrderLine,
  type PublicCategory,
  type Tenant,
} from '@hiper/shared';
import { auth, db } from './admin';
import { parseInput, requireAuth } from './context';

/**
 * Roteador para a distância de rua entre a loja e o cliente. O servidor
 * público do OSRM serve só para desenvolvimento; em produção aponte para uma
 * instância própria (OSRM ou OpenRouteService).
 */
const OSRM_URL = process.env.OSRM_URL ?? 'https://router.project-osrm.org';

export async function roadDistanceKm(from: LatLng, to: LatLng): Promise<number> {
  try {
    const url = `${OSRM_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const body = (await res.json()) as { routes?: Array<{ distance: number }> };
      const meters = body.routes?.[0]?.distance;
      if (typeof meters === 'number') return Math.round(meters / 10) / 100;
    }
  } catch (error) {
    logger.warn('OSRM indisponível; usando estimativa', { error: String(error) });
  }
  return estimateRoadKm(from, to);
}

/** Id do pedido estável por cliente e tentativa: repetir a chamada não duplica. */
function orderIdFor(uid: string, clientRequestId: string): string {
  return createHash('sha256').update(`${uid}:${clientRequestId}`).digest('hex').slice(0, 20);
}

/**
 * Cria o pedido recalculando tudo no servidor: produtos e opções vêm do
 * catálogo público, o frete das regras da loja e a distância do roteador. Se
 * o total for diferente do que o cliente viu, o pedido não é criado e o app
 * mostra o valor novo.
 */
export const createOrder = onCall(async (request) => {
  const uid = requireAuth(request);
  const input = parseInput(createOrderInputSchema, request.data);
  const nowMs = Date.now();

  const tenantSnap = await db.doc(paths.tenant(input.tenantId)).get();
  const tenant = tenantSnap.data() as (Tenant & Record<string, unknown>) | undefined;
  if (!tenant || !isTenantSelling(tenant.status)) {
    throw new HttpsError('failed-precondition', 'Esta loja não está recebendo pedidos.');
  }
  const operation = tenantOperationSchema.safeParse(tenant);
  if (!operation.success) {
    throw new HttpsError('failed-precondition', 'A loja ainda não configurou horários e entrega.');
  }
  const { openingHours, prepTimeMinutes, delivery } = operation.data;
  if (!isOpenAt(openingHours, new Date(nowMs))) {
    throw new HttpsError('failed-precondition', 'A loja está fechada agora.');
  }

  const catalogRefs = input.lines.map((l) =>
    db.doc(paths.catalogItem(input.tenantId, l.productId)),
  );
  const catalogSnaps = await db.getAll(...catalogRefs);

  const lines: OrderLine[] = [];
  for (const [i, line] of input.lines.entries()) {
    const item = catalogSnaps[i]?.data() as CatalogItem | undefined;
    if (!item) {
      throw new HttpsError('failed-precondition', 'Um produto do carrinho saiu da loja.', {
        productId: line.productId,
      });
    }
    const priced = priceLine(item, line.quantity, line.options, nowMs);
    if (!priced.ok) {
      throw new HttpsError(
        'failed-precondition',
        `${item.name}: ${describeLineProblem(priced.problems[0]!)}`,
        { productId: line.productId, problems: priced.problems },
      );
    }
    lines.push({
      productId: line.productId,
      name: item.name,
      photo: item.photos[0] ?? null,
      quantity: line.quantity,
      saleUnit: item.saleUnit,
      unitPriceCents: priced.unitPriceCents,
      totalCents: priced.totalCents,
      options: priced.options,
      notes: line.notes,
    });
  }
  const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);
  if (subtotalCents < delivery.minOrderCents) {
    throw new HttpsError('failed-precondition', 'O pedido não atingiu o valor mínimo da loja.', {
      minOrderCents: delivery.minOrderCents,
    });
  }

  const storeLocation = tenant.address?.location ?? null;
  let fee = 0;
  let distanceKm: number | null = null;
  let etaMinutes: number | null = prepTimeMinutes;
  if (input.fulfillment === 'pickup') {
    if (!delivery.pickupEnabled) {
      throw new HttpsError('failed-precondition', 'Esta loja não aceita retirada.');
    }
  } else {
    const address = input.address!;
    if (delivery.mode === 'radius') {
      if (!storeLocation) {
        throw new HttpsError('failed-precondition', 'A loja ainda não marcou o endereço no mapa.');
      }
      distanceKm = await roadDistanceKm(storeLocation, address.location);
    }
    const computed = deliveryFeeCents(
      delivery,
      distanceKm !== null ? { distanceKm } : { district: address.district },
      subtotalCents,
    );
    if (computed === null) {
      throw new HttpsError('out-of-range', 'Seu endereço está fora da área de entrega da loja.');
    }
    fee = computed;
    const tierEta =
      delivery.mode === 'radius'
        ? delivery.radiusTiers.find((t) => distanceKm! <= t.upToKm)?.etaMinutes
        : delivery.districts.find((d) => d.name === address.district)?.etaMinutes;
    etaMinutes = prepTimeMinutes + (tierEta ?? 0);
  }

  const totalCents = subtotalCents + fee;
  if (totalCents !== input.expectedTotalCents) {
    throw new HttpsError('aborted', 'Os valores mudaram. Confira o pedido de novo.', {
      totalCents,
      subtotalCents,
      deliveryFeeCents: fee,
    });
  }
  if (input.payment.method === 'pix') {
    // Pix entra com o gateway de pagamento (Etapa 5).
    throw new HttpsError('unimplemented', 'Pagamento por Pix ainda não está disponível.');
  }
  const changeFor = input.payment.method === 'cash' ? input.payment.changeForCents : null;
  if (changeFor !== null && changeFor < totalCents) {
    throw new HttpsError(
      'invalid-argument',
      'O troco precisa ser para um valor maior que o total.',
    );
  }

  const [user, profile] = await Promise.all([auth.getUser(uid), db.doc(paths.user(uid)).get()]);
  const customerName =
    (profile.get('displayName') as string | undefined) ?? user.displayName ?? 'Cliente';

  const orderId = orderIdFor(uid, input.clientRequestId);
  const orderRef = db.doc(orderPaths.order(input.tenantId, orderId));
  const counterRef = db.doc(orderPaths.orderCounter(input.tenantId));

  const number = await db.runTransaction(async (tx) => {
    const [existing, counter] = await Promise.all([tx.get(orderRef), tx.get(counterRef)]);
    if (existing.exists) return existing.get('number') as number;
    const next = ((counter.get('last') as number | undefined) ?? 1000) + 1;
    tx.set(counterRef, { last: next }, { merge: true });
    const now = FieldValue.serverTimestamp();
    tx.create(orderRef, {
      tenantId: input.tenantId,
      storeSlug: tenant.slug,
      storeName: tenant.tradeName,
      number: next,
      customerUid: uid,
      customerName,
      customerPhone: input.customerPhone,
      status: 'pending',
      history: [{ status: 'pending', atMs: nowMs }],
      fulfillment: input.fulfillment,
      address: input.fulfillment === 'delivery' ? input.address : null,
      distanceKm,
      etaMinutes,
      lines,
      subtotalCents,
      deliveryFeeCents: fee,
      totalCents,
      payment: { method: input.payment.method, changeForCents: changeFor, status: 'pending' },
      notes: input.notes,
      courier: null,
      storeLocation,
      clientRequestId: input.clientRequestId,
      createdAt: now,
      updatedAt: now,
    } satisfies Record<keyof Order, unknown>);
    return next;
  });

  logger.info('Pedido criado', { tenantId: input.tenantId, orderId, number, totalCents });
  return { orderId, number, totalCents };
});

/** Leva à vitrine só nome, ordem e hierarquia das categorias ativas. */
export const syncPublicCategories = onDocumentWritten(
  'tenants/{tenantId}/categories/{categoryId}',
  async (event) => {
    const { tenantId, categoryId } = event.params;
    const ref = db.doc(orderPaths.publicCategory(tenantId, categoryId));
    const data = event.data?.after.data();
    if (!data || data.active !== true) {
      await ref.delete();
      return;
    }
    await ref.set({
      name: data.name,
      parentId: data.parentId ?? null,
      displayOrder: data.displayOrder ?? 0,
    } satisfies PublicCategory);
  },
);

/**
 * Exclusão da conta pelo próprio cliente (exigência da Apple e do Google).
 * Apaga perfil e endereços; os pedidos ficam para a loja por obrigação
 * fiscal, mas sem nome nem telefone.
 */
export const deleteAccount = onCall(async (request) => {
  const uid = requireAuth(request);
  const addresses = await db.collection(orderPaths.addresses(uid)).listDocuments();
  const orders = await db.collectionGroup('orders').where('customerUid', '==', uid).get();

  const writer = db.bulkWriter();
  for (const ref of addresses) writer.delete(ref);
  for (const order of orders.docs) {
    writer.update(order.ref, {
      customerName: 'Conta excluída',
      customerPhone: '',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  writer.delete(db.doc(paths.user(uid)));
  await writer.close();
  await auth.deleteUser(uid);
  logger.info('Conta excluída', { uid, orders: orders.size });
  return { ok: true };
});
