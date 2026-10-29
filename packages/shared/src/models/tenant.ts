import { z } from 'zod';
import { isValidCnpj, normalizeCnpj } from '../cnpj';
import { addressSchema, phoneSchema, type TimestampLike } from './common';

/** Segmentos atendidos; definem quais recursos do catálogo aparecem. */
export const SEGMENTS = ['restaurant', 'bakery', 'grocery', 'pharmacy', 'retail', 'other'] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, string> = {
  restaurant: 'Restaurante, lanchonete ou pizzaria',
  bakery: 'Açaiteria, doceria ou padaria',
  grocery: 'Supermercado, mercearia ou hortifrúti',
  pharmacy: 'Farmácia',
  retail: 'Loja (roupa, pet, material de construção)',
  other: 'Outro',
};

/** Ciclo de vida da assinatura (ver "Gestão dos comércios clientes" no plano). */
export const TENANT_STATUSES = [
  'trial',
  'active',
  'overdue',
  'restricted',
  'suspended',
  'cancelled',
] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const PLANS = ['essential', 'professional', 'complete', 'network'] as const;
export type Plan = (typeof PLANS)[number];

export const TAX_REGIMES = [
  'simples_nacional',
  'simples_excesso',
  'lucro_presumido',
  'lucro_real',
  'mei',
] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export const TRIAL_DAYS = 14;

export const slugSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens');

/** Endereços que não podem virar loja por conflitarem com rotas do produto. */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'www',
  'painel',
  'loja',
  'entregador',
  'suporte',
  'ajuda',
  'login',
  'cadastro',
  'conta',
  'hiper',
  'hiperdelivery',
  'status',
  'blog',
]);

export const cnpjSchema = z.string().transform(normalizeCnpj).refine(isValidCnpj, 'CNPJ inválido');

/** Dados que o lojista informa ao criar a empresa (Function createTenant). */
export const createTenantInputSchema = z.object({
  tradeName: z.string().trim().min(2).max(80),
  slug: slugSchema.refine((s) => !RESERVED_SLUGS.has(s), 'Endereço reservado'),
  segment: z.enum(SEGMENTS),
  cnpj: cnpjSchema.nullable().default(null),
  phone: phoneSchema.nullable().default(null),
});
export type CreateTenantInput = z.infer<typeof createTenantInputSchema>;

/** Campos operacionais que dono e gerente editam direto pelo painel. */
export const tenantProfileSchema = z.object({
  tradeName: z.string().trim().min(2).max(80),
  phone: phoneSchema.nullable(),
  email: z.email().nullable(),
  address: addressSchema.nullable(),
  logoPath: z.string().max(300).nullable(),
});
export type TenantProfile = z.infer<typeof tenantProfileSchema>;
export const TENANT_PROFILE_FIELDS = Object.keys(tenantProfileSchema.shape) as Array<
  keyof TenantProfile
>;

/** Campos legais e fiscais que só o dono edita. */
export const tenantLegalSchema = z.object({
  legalName: z.string().trim().min(2).max(150).nullable(),
  cnpj: cnpjSchema.nullable(),
  stateRegistration: z.string().max(20).nullable(),
  taxRegime: z.enum(TAX_REGIMES).nullable(),
});
export type TenantLegal = z.infer<typeof tenantLegalSchema>;
export const TENANT_LEGAL_FIELDS = Object.keys(tenantLegalSchema.shape) as Array<keyof TenantLegal>;

/** tenants/{tenantId} */
export interface Tenant extends TenantProfile, TenantLegal {
  slug: string;
  segment: Segment;
  ownerUid: string;
  /** Só Functions alteram: dependem de cobrança. */
  status: TenantStatus;
  plan: Plan;
  trialEndsAt: TimestampLike;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  updatedBy: string;
}

/** publicStores/{slug}: leitura pública, aponta o endereço da loja para a empresa. */
export interface PublicStore {
  tenantId: string;
  tradeName: string;
  segment: Segment;
  logoPath: string | null;
  /** false quando a loja está restrita, suspensa ou cancelada. */
  open: boolean;
}

/** Status em que a loja aparece para novos pedidos. */
export function isTenantSelling(status: TenantStatus): boolean {
  return status === 'trial' || status === 'active' || status === 'overdue';
}
