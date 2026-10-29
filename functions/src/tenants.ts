import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import {
  createTenantInputSchema,
  isTenantSelling,
  paths,
  TRIAL_DAYS,
  type PublicStore,
  type Tenant,
} from '@hiper/shared';
import { auth, db } from './admin';
import { writeAudit } from './audit';
import { withTenantClaims } from './claims';
import { parseInput, requireAuth } from './context';

/**
 * Cadastro self-service da empresa. Quem chama vira o dono: a Function cria a
 * empresa, o vínculo e o endereço público da loja numa transação e grava
 * tid/role nos claims. O app precisa renovar o token depois (getIdToken(true)).
 */
export const createTenant = onCall(async (request) => {
  const uid = requireAuth(request);
  const input = parseInput(createTenantInputSchema, request.data);
  const user = await auth.getUser(uid);

  const tenantRef = db.collection('tenants').doc();
  const tenantId = tenantRef.id;
  const membershipRef = db.doc(`memberships/${uid}`);
  const storeRef = db.doc(paths.publicStore(input.slug));

  await db.runTransaction(async (tx) => {
    const [membership, store] = await Promise.all([tx.get(membershipRef), tx.get(storeRef)]);
    if (membership.exists) {
      throw new HttpsError('failed-precondition', 'Você já faz parte de uma empresa.');
    }
    if (store.exists) {
      throw new HttpsError('already-exists', 'Este endereço de loja já está em uso.');
    }

    const now = FieldValue.serverTimestamp();
    const trialEndsAt = Timestamp.fromMillis(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    tx.create(tenantRef, {
      tradeName: input.tradeName,
      slug: input.slug,
      segment: input.segment,
      phone: input.phone,
      email: user.email ?? null,
      address: null,
      logoPath: null,
      legalName: null,
      cnpj: input.cnpj,
      stateRegistration: null,
      taxRegime: null,
      ownerUid: uid,
      status: 'trial',
      plan: 'essential',
      trialEndsAt,
      createdAt: now,
      updatedAt: now,
      updatedBy: uid,
    } satisfies Record<keyof Tenant, unknown>);
    tx.create(db.doc(paths.member(tenantId, uid)), {
      uid,
      role: 'owner',
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      active: true,
      addedAt: now,
      addedBy: uid,
      claimsUpdatedAt: now,
    });
    tx.create(membershipRef, { tenantId, role: 'owner', updatedAt: now });
    tx.create(storeRef, {
      tenantId,
      tradeName: input.tradeName,
      segment: input.segment,
      logoPath: null,
      open: true,
    } satisfies PublicStore);
    writeAudit(tx, tenantId, {
      action: 'tenant.created',
      actorUid: uid,
      data: { slug: input.slug },
    });
  });

  await auth.setCustomUserClaims(uid, withTenantClaims(user.customClaims, tenantId, 'owner'));
  logger.info('Empresa criada', { tenantId, uid, slug: input.slug });
  return { tenantId };
});

/** Mantém o endereço público da loja em dia com o nome, a logo e o status. */
export const syncPublicStore = onDocumentUpdated('tenants/{tenantId}', async (event) => {
  const before = event.data?.before.data() as Tenant | undefined;
  const after = event.data?.after.data() as Tenant | undefined;
  if (!before || !after) return;
  const changed =
    before.tradeName !== after.tradeName ||
    before.logoPath !== after.logoPath ||
    before.segment !== after.segment ||
    isTenantSelling(before.status) !== isTenantSelling(after.status);
  if (!changed) return;
  await db.doc(paths.publicStore(after.slug)).set(
    {
      tenantId: event.params.tenantId,
      tradeName: after.tradeName,
      segment: after.segment,
      logoPath: after.logoPath,
      open: isTenantSelling(after.status),
    } satisfies PublicStore,
    { merge: true },
  );
});
