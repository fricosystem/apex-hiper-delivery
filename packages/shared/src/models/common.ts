import { z } from 'zod';

/**
 * Timestamp no formato comum ao SDK web e ao Admin SDK, para os tipos dos
 * documentos servirem aos dois lados.
 */
export interface TimestampLike {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
}

/** Campos de auditoria gravados em todo documento editável pela equipe. */
export interface AuditFields {
  createdAt: TimestampLike;
  createdBy: string;
  updatedAt: TimestampLike;
  updatedBy: string;
}

export const centsSchema = z.number().int().nonnegative().max(1_000_000_000);

export const percentSchema = z.number().min(0).max(100);

export const brazilianStates = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export const addressSchema = z.object({
  cep: z.string().regex(/^\d{8}$/, 'CEP com 8 dígitos'),
  street: z.string().min(1).max(200),
  number: z.string().min(1).max(20),
  complement: z.string().max(100).nullable().default(null),
  district: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  state: z.enum(brazilianStates),
  /** Ponto no mapa, ajustável pelo lojista; usado para frete e corridas. */
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .default(null),
});
export type Address = z.infer<typeof addressSchema>;

export const phoneSchema = z.string().regex(/^\d{10,11}$/, 'Telefone com DDD, só números');
