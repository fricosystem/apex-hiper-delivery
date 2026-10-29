import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import {
  collectionGroup,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import {
  orderPaths,
  paths,
  productInputSchema,
  productSearchKeywords,
  toCatalogItem,
  WEEKDAYS,
  type CreateOrderInput,
} from '@hiper/shared';

/**
 * Pedido do cliente contra os emuladores: a Function recalcula preço e frete
 * a partir do catálogo e das regras da loja, não duplica numa nova tentativa
 * e recusa o que estiver fora das regras.
 */

const PROJECT_ID = 'demo-hiper-delivery';
const REGION = 'southamerica-east1';
const run = Math.random().toString(36).slice(2, 8);
const tenantId = `loja-pedidos-${run}`;

const admin = initAdmin({ projectId: PROJECT_ID }, `admin-${run}`);
const adminDb = getAdminFirestore(admin);
const apps: FirebaseApp[] = [];

async function customer(name: string) {
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, `${name}-${run}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db: Firestore = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, REGION);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const { user } = await createUserWithEmailAndPassword(
    auth,
    `${name}-${run}@teste.com`,
    'senha-123',
  );
  return {
    user,
    db,
    call: async <T>(fn: string, data: unknown) =>
      (await httpsCallable(functions, fn)(data)).data as T,
  };
}

const allDay = Object.fromEntries(WEEKDAYS.map((d) => [d, [{ open: '00:00', close: '23:59' }]]));
const store = { lat: -23.5505, lng: -46.6333 };

beforeAll(async () => {
  await adminDb.doc(paths.tenant(tenantId)).set({
    tradeName: 'Burger da Vila',
    slug: `burger-${run}`,
    segment: 'restaurant',
    status: 'trial',
    address: {
      cep: '01001000',
      street: 'Praça da Sé',
      number: '1',
      complement: null,
      district: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      location: store,
    },
    openingHours: allDay,
    prepTimeMinutes: 20,
    delivery: {
      mode: 'radius',
      radiusTiers: [
        { upToKm: 5, feeCents: 500, etaMinutes: 25 },
        { upToKm: 10, feeCents: 900, etaMinutes: 40 },
      ],
      districts: [],
      minOrderCents: 2000,
      freeShippingAboveCents: null,
      pickupEnabled: true,
    },
  });
  const input = productInputSchema.parse({
    internalCode: 'XB',
    name: 'X-Burger',
    pricing: { salePriceCents: 2500 },
    optionGroups: [
      {
        id: 'extras',
        name: 'Adicionais',
        min: 0,
        max: 1,
        options: [{ id: 'bacon', name: 'Bacon', priceDeltaCents: 400 }],
      },
    ],
  });
  await adminDb
    .doc(paths.catalogItem(tenantId, 'xb'))
    .set(toCatalogItem({ ...input, searchKeywords: productSearchKeywords(input) })!);
});

afterAll(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)));
  await deleteAdminApp(admin);
});

const near = {
  cep: '01310100',
  street: 'Avenida Paulista',
  number: '1000',
  complement: null,
  district: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP' as const,
  location: { lat: -23.5614, lng: -46.6559 },
  reference: null,
};

function orderInput(over: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    tenantId,
    lines: [
      {
        productId: 'xb',
        quantity: 2,
        options: [{ groupId: 'extras', optionIds: ['bacon'] }],
        notes: '',
      },
    ],
    fulfillment: 'delivery',
    address: near,
    payment: { method: 'cash', changeForCents: null },
    customerPhone: '11999998888',
    notes: '',
    expectedTotalCents: 0,
    clientRequestId: `req-${run}-1`,
    ...over,
  };
}

describe('pedido do cliente', () => {
  it('recalcula no servidor, cria o pedido e não duplica na nova tentativa', async () => {
    const ana = await customer('ana');
    // Total errado: a Function devolve o valor certo sem criar o pedido.
    const err = await ana.call('createOrder', orderInput()).catch((e) => e);
    expect(err.code).toBe('functions/aborted');
    const { totalCents, deliveryFeeCents } = err.details as {
      totalCents: number;
      deliveryFeeCents: number;
    };
    expect(totalCents).toBe(2 * 2900 + deliveryFeeCents);
    expect([500, 900]).toContain(deliveryFeeCents);

    const input = orderInput({ expectedTotalCents: totalCents });
    const first = await ana.call<{ orderId: string; number: number }>('createOrder', input);
    const again = await ana.call<{ orderId: string; number: number }>('createOrder', input);
    expect(again).toMatchObject({ orderId: first.orderId, number: first.number });

    const order = await getDoc(doc(ana.db, orderPaths.order(tenantId, first.orderId)));
    expect(order.data()).toMatchObject({
      status: 'pending',
      customerUid: ana.user.uid,
      subtotalCents: 5800,
      totalCents,
      storeName: 'Burger da Vila',
    });
    expect(order.data()?.lines[0]).toMatchObject({ unitPriceCents: 2900, totalCents: 5800 });

    const history = await getDocs(
      query(
        collectionGroup(ana.db, 'orders'),
        where('customerUid', '==', ana.user.uid),
        orderBy('createdAt', 'desc'),
        limit(20),
      ),
    );
    expect(history.size).toBe(1);
  });

  it('recusa abaixo do mínimo, fora da área, opção inexistente e Pix sem gateway', async () => {
    const bia = await customer('bia');
    const code = (p: Promise<unknown>) => p.catch((e) => e.code as string);
    expect(
      await code(
        bia.call(
          'createOrder',
          orderInput({ lines: [{ productId: 'xb', quantity: 0.5, options: [], notes: '' }] }),
        ),
      ),
    ).toBe('functions/failed-precondition');
    expect(
      await code(
        bia.call(
          'createOrder',
          orderInput({ address: { ...near, location: { lat: -22.9068, lng: -43.1729 } } }),
        ),
      ),
    ).toBe('functions/out-of-range');
    expect(
      await code(
        bia.call(
          'createOrder',
          orderInput({
            lines: [
              {
                productId: 'xb',
                quantity: 1,
                options: [{ groupId: 'extras', optionIds: ['ovo'] }],
                notes: '',
              },
            ],
          }),
        ),
      ),
    ).toBe('functions/failed-precondition');
    expect(
      await code(
        bia.call(
          'createOrder',
          orderInput({
            fulfillment: 'pickup',
            address: null,
            expectedTotalCents: 5800,
            payment: { method: 'pix', changeForCents: null },
          }),
        ),
      ),
    ).toBe('functions/unimplemented');
  });

  it('retirada na loja não cobra frete', async () => {
    const caio = await customer('caio');
    const result = await caio.call<{ totalCents: number }>(
      'createOrder',
      orderInput({
        fulfillment: 'pickup',
        address: null,
        expectedTotalCents: 5800,
        clientRequestId: `req-${run}-pickup`,
      }),
    );
    expect(result.totalCents).toBe(5800);
  });

  it('exclusão da conta apaga o perfil e tira nome e telefone dos pedidos', async () => {
    const dani = await customer('dani');
    const { orderId } = await dani.call<{ orderId: string }>(
      'createOrder',
      orderInput({
        fulfillment: 'pickup',
        address: null,
        expectedTotalCents: 5800,
        clientRequestId: `req-${run}-dani`,
      }),
    );
    await dani.call('deleteAccount', {});
    const order = await adminDb.doc(orderPaths.order(tenantId, orderId)).get();
    expect(order.data()).toMatchObject({ customerName: 'Conta excluída', customerPhone: '' });
  });
});
