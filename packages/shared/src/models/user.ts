import { z } from 'zod';
import { phoneSchema, type TimestampLike } from './common';

/**
 * users/{uid}: perfil de qualquer pessoa (cliente, lojista, entregador).
 * Uma conta compra em qualquer loja; cada loja só vê os pedidos feitos com ela.
 */
export const userProfileInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  phone: phoneSchema.nullable().default(null),
  marketingOptIn: z.boolean().default(false),
});
export type UserProfileInput = z.infer<typeof userProfileInputSchema>;

export type UserProfile = UserProfileInput & {
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};
