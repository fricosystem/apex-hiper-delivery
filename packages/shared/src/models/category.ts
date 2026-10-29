import { z } from 'zod';
import type { AuditFields } from './common';

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  /** Subcategoria aponta para a categoria pai; um nível só. */
  parentId: z.string().min(1).max(128).nullable().default(null),
  displayOrder: z.number().int().min(0).max(100_000).default(0),
  active: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

/** tenants/{tenantId}/categories/{categoryId} */
export type Category = CategoryInput & AuditFields;
