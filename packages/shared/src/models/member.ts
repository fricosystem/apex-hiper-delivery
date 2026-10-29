import { z } from 'zod';
import { TENANT_ROLES, type TenantRole } from '../roles';
import type { TimestampLike } from './common';

/** tenants/{tenantId}/members/{uid}: gravado só por Functions. */
export interface Member {
  uid: string;
  role: TenantRole;
  displayName: string | null;
  email: string | null;
  active: boolean;
  addedAt: TimestampLike;
  addedBy: string;
  /**
   * Muda sempre que os claims do usuário mudam. O app escuta o próprio
   * documento e força a renovação do token quando este valor muda.
   */
  claimsUpdatedAt: TimestampLike;
}

export const addMemberInputSchema = z.object({
  email: z.email(),
  role: z.enum(TENANT_ROLES),
});
export type AddMemberInput = z.infer<typeof addMemberInputSchema>;

export const setMemberRoleInputSchema = z.object({
  uid: z.string().min(1).max(128),
  /** null remove o usuário da empresa. */
  role: z.enum(TENANT_ROLES).nullable(),
});
export type SetMemberRoleInput = z.infer<typeof setMemberRoleInputSchema>;
