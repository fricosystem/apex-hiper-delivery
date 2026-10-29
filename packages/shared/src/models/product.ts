import { z } from 'zod';
import { isValidGtin, normalizeGtin } from '../gtin';
import { buildSearchKeywords } from '../search';
import { centsSchema, percentSchema, type AuditFields } from './common';

/**
 * Ficha do produto, dividida nas abas do painel: Identificação, Preços,
 * Estoque, Fiscal, Logística e Venda online. Custo de compra e fornecedores
 * ficam em outro documento (productCostInputSchema), lido só por quem pode
 * ver custo, porque as Security Rules valem por documento e não por campo.
 */

export const SALE_UNITS = ['un', 'kg', 'g', 'l', 'ml', 'cx', 'fardo', 'pct', 'dz'] as const;
export type SaleUnit = (typeof SALE_UNITS)[number];

export const SALE_UNIT_LABELS: Record<SaleUnit, string> = {
  un: 'Unidade',
  kg: 'Quilo',
  g: 'Grama',
  l: 'Litro',
  ml: 'Mililitro',
  cx: 'Caixa',
  fardo: 'Fardo',
  pct: 'Pacote',
  dz: 'Dúzia',
};

/** Origem da mercadoria (tabela da NF-e, 0 a 8). */
export const MERCHANDISE_ORIGINS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

export const TEMPERATURES = ['ambient', 'refrigerated', 'frozen'] as const;
export type Temperature = (typeof TEMPERATURES)[number];

const gtinSchema = z
  .string()
  .transform(normalizeGtin)
  .refine(isValidGtin, 'GTIN/EAN inválido (confira o dígito verificador)');

/** Variações (tamanho, sabor) e adicionais (bacon extra), agrupados. */
export const optionGroupSchema = z
  .object({
    id: z.string().min(1).max(40),
    name: z.string().trim().min(1).max(60),
    /** Mínimo de escolhas; 1 torna o grupo obrigatório (ex.: tamanho). */
    min: z.number().int().min(0).max(50),
    max: z.number().int().min(1).max(50),
    options: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          name: z.string().trim().min(1).max(60),
          priceDeltaCents: centsSchema,
          available: z.boolean().default(true),
        }),
      )
      .min(1)
      .max(50),
  })
  .refine((g) => g.min <= g.max, 'Mínimo maior que o máximo')
  .refine((g) => g.max <= g.options.length, 'Máximo maior que o número de opções');
export type OptionGroup = z.infer<typeof optionGroupSchema>;

export const identificationSchema = z.object({
  internalCode: z.string().trim().min(1).max(30),
  /** Um produto pode ter mais de um código de barras (embalagens diferentes). */
  gtins: z
    .array(gtinSchema)
    .max(10)
    .default([])
    .refine((list) => new Set(list).size === list.length, 'Código de barras repetido'),
  sku: z.string().trim().max(40).nullable().default(null),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(''),
  brand: z.string().trim().max(60).nullable().default(null),
  categoryId: z.string().min(1).max(128).nullable().default(null),
  subcategoryId: z.string().min(1).max(128).nullable().default(null),
  /** Caminhos no Storage (storagePaths.productPhoto); a primeira é a capa. */
  photos: z.array(z.string().max(300)).max(10).default([]),
  saleUnit: z.enum(SALE_UNITS).default('un'),
  optionGroups: z.array(optionGroupSchema).max(20).default([]),
});

export const pricingSchema = z
  .object({
    salePriceCents: centsSchema,
    promo: z
      .object({
        priceCents: centsSchema,
        /** Início e fim em milissegundos desde 1970 (UTC). */
        startsAtMs: z.number().int().nonnegative(),
        endsAtMs: z.number().int().nonnegative(),
      })
      .refine((p) => p.endsAtMs > p.startsAtMs, 'Fim da promoção antes do início')
      .nullable()
      .default(null),
  })
  .refine(
    (p) => p.promo === null || p.promo.priceCents < p.salePriceCents,
    'Preço promocional precisa ser menor que o preço de venda',
  );

export const stockSchema = z.object({
  /** false: produto feito na hora (lanche), sem controle de quantidade. */
  tracked: z.boolean().default(false),
  /** Em unidades de venda; aceita fração quando vendido por peso. */
  quantity: z.number().min(-1_000_000).max(1_000_000).default(0),
  min: z.number().min(0).max(1_000_000).nullable().default(null),
  max: z.number().min(0).max(1_000_000).nullable().default(null),
  location: z
    .object({ aisle: z.string().max(20), shelf: z.string().max(20) })
    .nullable()
    .default(null),
  batchControl: z.boolean().default(false),
  byWeight: z.boolean().default(false),
  /** Conversão de embalagem: 1 caixa = 12 unidades. */
  packConversion: z
    .object({ packUnit: z.enum(SALE_UNITS), unitsPerPack: z.number().positive().max(10_000) })
    .nullable()
    .default(null),
});

export const fiscalSchema = z.object({
  ncm: z
    .string()
    .regex(/^\d{8}$/, 'NCM com 8 dígitos')
    .nullable()
    .default(null),
  cest: z
    .string()
    .regex(/^\d{7}$/, 'CEST com 7 dígitos')
    .nullable()
    .default(null),
  cfop: z
    .string()
    .regex(/^\d{4}$/, 'CFOP com 4 dígitos')
    .nullable()
    .default(null),
  origin: z
    .number()
    .int()
    .refine((n) => (MERCHANDISE_ORIGINS as readonly number[]).includes(n), 'Origem inválida')
    .default(0),
  /** CST do ICMS (regime normal) ou CSOSN (Simples Nacional), conforme a loja. */
  cst: z
    .string()
    .regex(/^\d{2,3}$/)
    .nullable()
    .default(null),
  csosn: z
    .string()
    .regex(/^\d{3}$/)
    .nullable()
    .default(null),
  icmsRate: percentSchema.nullable().default(null),
  pisRate: percentSchema.nullable().default(null),
  cofinsRate: percentSchema.nullable().default(null),
  ipiRate: percentSchema.nullable().default(null),
});

export const logisticsSchema = z.object({
  grossWeightG: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  netWeightG: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  dimensionsCm: z
    .object({
      length: z.number().positive().max(1000),
      width: z.number().positive().max(1000),
      height: z.number().positive().max(1000),
    })
    .nullable()
    .default(null),
  fragile: z.boolean().default(false),
  temperature: z.enum(TEMPERATURES).default('ambient'),
});

export const onlineSaleSchema = z.object({
  visible: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(100_000).default(0),
  ageRestricted: z.boolean().default(false),
  requiresPrescription: z.boolean().default(false),
  maxPerOrder: z.number().int().positive().max(1000).nullable().default(null),
});

export const productInputSchema = identificationSchema.extend({
  pricing: pricingSchema,
  stock: stockSchema.prefault({}),
  fiscal: fiscalSchema.prefault({}),
  logistics: logisticsSchema.prefault({}),
  online: onlineSaleSchema.prefault({}),
  /** Pausa rápida (acabou no meio do turno); o atendente também pode mudar. */
  paused: z.boolean().default(false),
});
export type ProductInput = z.infer<typeof productInputSchema>;

/** tenants/{tenantId}/products/{productId} */
export type Product = ProductInput & AuditFields & { searchKeywords: string[] };

/** Campos que o atendente pode alterar num produto. */
export const PRODUCT_PAUSE_FIELDS = ['paused', 'updatedAt', 'updatedBy'] as const;

export function productSearchKeywords(
  p: Pick<ProductInput, 'name' | 'brand' | 'gtins' | 'sku' | 'internalCode'>,
): string[] {
  return buildSearchKeywords(p.name, p.brand, p.sku, p.internalCode, ...p.gtins);
}

export const supplierRefSchema = z.object({
  supplierId: z.string().min(1).max(128).nullable().default(null),
  name: z.string().trim().min(1).max(120),
  /** Código do item no catálogo do fornecedor. */
  itemCode: z.string().trim().max(40).nullable().default(null),
  lastPriceCents: centsSchema.nullable().default(null),
});

/** tenants/{tenantId}/productCosts/{productId}: mesmo id do produto. */
export const productCostInputSchema = z.object({
  purchasePriceCents: centsSchema.default(0),
  purchaseFreightCents: centsSchema.default(0),
  purchaseTaxesCents: centsSchema.default(0),
  /** Custo médio ponderado; recalculado a cada entrada de estoque. */
  averageCostCents: centsSchema.nullable().default(null),
  suppliers: z.array(supplierRefSchema).max(20).default([]),
});
export type ProductCostInput = z.infer<typeof productCostInputSchema>;
export type ProductCost = ProductCostInput & AuditFields;

/** Preço que vale agora, considerando a promoção ativa. */
export function effectivePriceCents(
  pricing: Pick<ProductInput['pricing'], 'salePriceCents' | 'promo'>,
  nowMs: number = Date.now(),
): number {
  const { promo } = pricing;
  if (promo && nowMs >= promo.startsAtMs && nowMs < promo.endsAtMs) return promo.priceCents;
  return pricing.salePriceCents;
}
