import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { isTenantRole, type TenantRole } from '@hiper/shared';
import type { z } from 'zod';

export interface TenantCaller {
  uid: string;
  tenantId: string;
  role: TenantRole;
}

export function requireAuth(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  return request.auth.uid;
}

/** Usuário logado e vinculado a uma empresa, com um dos perfis permitidos. */
export function requireTenantRole(
  request: CallableRequest,
  allowed: readonly TenantRole[],
): TenantCaller {
  const uid = requireAuth(request);
  const { tid, role } = request.auth!.token as { tid?: unknown; role?: unknown };
  if (typeof tid !== 'string' || !isTenantRole(role)) {
    throw new HttpsError('permission-denied', 'Usuário não pertence a uma empresa.');
  }
  if (!allowed.includes(role)) {
    throw new HttpsError('permission-denied', 'Seu perfil não tem permissão para esta ação.');
  }
  return { uid, tenantId: tid, role };
}

export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpsError('invalid-argument', 'Dados inválidos.', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}
