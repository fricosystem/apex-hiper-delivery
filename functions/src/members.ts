import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  addMemberInputSchema,
  assignableRoles,
  isTenantRole,
  MEMBER_MANAGERS,
  paths,
  setMemberRoleInputSchema,
  type TenantRole,
} from '@hiper/shared';
import { auth, db } from './admin';
import { writeAudit } from './audit';
import { withTenantClaims } from './claims';
import { parseInput, requireTenantRole } from './context';
import { roleChangeDenial } from './members-policy';

interface Membership {
  tenantId: string;
  role: TenantRole;
}

/**
 * O perfil de quem chama é conferido no banco, não só no token, porque um
 * token antigo pode trazer um perfil que já foi retirado.
 */
async function currentRole(uid: string, tenantId: string): Promise<TenantRole> {
  const snap = await db.doc(`memberships/${uid}`).get();
  const m = snap.data() as Membership | undefined;
  if (!m || m.tenantId !== tenantId || !isTenantRole(m.role)) {
    throw new HttpsError('permission-denied', 'Você não faz mais parte desta empresa.');
  }
  return m.role;
}

/** Adiciona à equipe uma pessoa que já tem conta no Hiper Delivery. */
export const addMember = onCall(async (request) => {
  const caller = requireTenantRole(request, MEMBER_MANAGERS);
  const input = parseInput(addMemberInputSchema, request.data);
  const actorRole = await currentRole(caller.uid, caller.tenantId);
  if (!assignableRoles(actorRole).includes(input.role)) {
    throw new HttpsError('permission-denied', 'Seu perfil não pode atribuir este perfil.');
  }

  const user = await auth.getUserByEmail(input.email).catch(() => {
    throw new HttpsError(
      'not-found',
      'Nenhuma conta com este e-mail. Peça para a pessoa se cadastrar primeiro.',
    );
  });
  const membershipRef = db.doc(`memberships/${user.uid}`);

  await db.runTransaction(async (tx) => {
    const membership = await tx.get(membershipRef);
    if (membership.exists) {
      throw new HttpsError('failed-precondition', 'Esta pessoa já faz parte de uma empresa.');
    }
    const now = FieldValue.serverTimestamp();
    tx.create(membershipRef, { tenantId: caller.tenantId, role: input.role, updatedAt: now });
    tx.create(db.doc(paths.member(caller.tenantId, user.uid)), {
      uid: user.uid,
      role: input.role,
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      active: true,
      addedAt: now,
      addedBy: caller.uid,
      claimsUpdatedAt: now,
    });
    writeAudit(tx, caller.tenantId, {
      action: 'member.added',
      actorUid: caller.uid,
      targetUid: user.uid,
      data: { role: input.role },
    });
  });

  await auth.setCustomUserClaims(
    user.uid,
    withTenantClaims(user.customClaims, caller.tenantId, input.role),
  );
  logger.info('Membro adicionado', { tenantId: caller.tenantId, uid: user.uid, role: input.role });
  return { uid: user.uid };
});

/** Muda o perfil de alguém da equipe, ou remove (role: null). */
export const setMemberRole = onCall(async (request) => {
  const caller = requireTenantRole(request, MEMBER_MANAGERS);
  const input = parseInput(setMemberRoleInputSchema, request.data);
  const membershipRef = db.doc(`memberships/${input.uid}`);
  const memberRef = db.doc(paths.member(caller.tenantId, input.uid));

  await db.runTransaction(async (tx) => {
    const [actorSnap, targetSnap, owners] = await Promise.all([
      tx.get(db.doc(`memberships/${caller.uid}`)),
      tx.get(membershipRef),
      tx.get(db.collection(paths.members(caller.tenantId)).where('role', '==', 'owner').count()),
    ]);
    const actor = actorSnap.data() as Membership | undefined;
    const target = targetSnap.data() as Membership | undefined;
    if (!actor || actor.tenantId !== caller.tenantId) {
      throw new HttpsError('permission-denied', 'Você não faz mais parte desta empresa.');
    }
    if (!target || target.tenantId !== caller.tenantId) {
      throw new HttpsError('not-found', 'Pessoa não encontrada na equipe.');
    }
    const denial = roleChangeDenial({
      actorUid: caller.uid,
      actorRole: actor.role,
      targetUid: input.uid,
      targetRole: target.role,
      newRole: input.role,
      ownerCount: owners.data().count,
    });
    if (denial) throw new HttpsError('permission-denied', denial);

    const now = FieldValue.serverTimestamp();
    if (input.role === null) {
      tx.delete(membershipRef);
      tx.delete(memberRef);
    } else {
      tx.update(membershipRef, { role: input.role, updatedAt: now });
      tx.update(memberRef, { role: input.role, claimsUpdatedAt: now });
    }
    writeAudit(tx, caller.tenantId, {
      action: input.role === null ? 'member.removed' : 'member.role_changed',
      actorUid: caller.uid,
      targetUid: input.uid,
      data: { from: target.role, to: input.role },
    });
  });

  const user = await auth.getUser(input.uid);
  await auth.setCustomUserClaims(
    input.uid,
    withTenantClaims(user.customClaims, caller.tenantId, input.role),
  );
  // Sem a empresa, as sessões abertas da pessoa precisam cair.
  if (input.role === null) await auth.revokeRefreshTokens(input.uid);
  return { ok: true };
});
