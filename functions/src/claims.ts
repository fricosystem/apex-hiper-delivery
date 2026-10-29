import type { HiperClaims, TenantRole } from '@hiper/shared';

/**
 * Monta os novos claims preservando os que não são da empresa (courier, staff).
 * role null remove o vínculo com a empresa.
 */
export function withTenantClaims(
  current: Record<string, unknown> | undefined,
  tenantId: string,
  role: TenantRole | null,
): HiperClaims {
  const {
    tid: _tid,
    role: _role,
    ...rest
  } = (current ?? {}) as HiperClaims & Record<string, unknown>;
  return role === null ? rest : { ...rest, tid: tenantId, role };
}
