import { assignableRoles, MEMBER_MANAGERS, type TenantRole } from '@hiper/shared';

export interface RoleChange {
  actorUid: string;
  actorRole: TenantRole;
  targetUid: string;
  targetRole: TenantRole;
  /** null remove o usuário da empresa. */
  newRole: TenantRole | null;
  /** Quantos donos a empresa tem hoje. */
  ownerCount: number;
}

/** Regra de quem pode mudar o perfil de quem. Retorna o motivo da recusa, ou null. */
export function roleChangeDenial(change: RoleChange): string | null {
  const { actorUid, actorRole, targetUid, targetRole, newRole, ownerCount } = change;
  if (!MEMBER_MANAGERS.includes(actorRole)) {
    return 'Seu perfil não gerencia a equipe.';
  }
  const privileged: readonly TenantRole[] = ['owner', 'manager'];
  if (actorRole !== 'owner' && privileged.includes(targetRole) && targetUid !== actorUid) {
    return 'Só o dono altera donos e gerentes.';
  }
  if (actorRole !== 'owner' && targetUid === actorUid && newRole !== null) {
    return 'Você não pode alterar o próprio perfil.';
  }
  if (newRole !== null && !assignableRoles(actorRole).includes(newRole)) {
    return 'Seu perfil não pode atribuir este perfil.';
  }
  if (targetRole === 'owner' && newRole !== 'owner' && ownerCount <= 1) {
    return 'A empresa precisa de pelo menos um dono.';
  }
  return null;
}
