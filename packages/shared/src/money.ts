/**
 * Valores em dinheiro são sempre centavos inteiros (number), nunca float de reais,
 * para não acumular erro de arredondamento em somas, splits e lançamentos.
 */

export type Cents = number;

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Converte "12,90", "12.90" ou 12.9 em 1290. */
export function toCents(reais: string | number): Cents {
  const n = typeof reais === 'number' ? reais : Number(reais.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error(`Valor inválido: ${reais}`);
  return Math.round(n * 100);
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100);
}

export interface PurchaseCost {
  purchasePriceCents: Cents;
  purchaseFreightCents: Cents;
  purchaseTaxesCents: Cents;
}

/** Custo unitário de compra = preço + frete + impostos da compra. */
export function unitCostCents(cost: PurchaseCost): Cents {
  return cost.purchasePriceCents + cost.purchaseFreightCents + cost.purchaseTaxesCents;
}

export interface MarginResult {
  /** Lucro bruto por unidade, em centavos (pode ser negativo). */
  profitCents: number;
  /** Margem sobre o preço de venda, em % (null sem preço de venda). */
  marginPct: number | null;
  /** Markup sobre o custo, em % (null sem custo). */
  markupPct: number | null;
}

/**
 * Margem = lucro / venda; markup = lucro / custo. Ex.: custo R$ 6,00 e venda
 * R$ 10,00 dão margem de 40% e markup de 66,67%.
 */
export function computeMargin(salePriceCents: Cents, costCents: Cents): MarginResult {
  const profitCents = salePriceCents - costCents;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    profitCents,
    marginPct: salePriceCents > 0 ? round2((profitCents / salePriceCents) * 100) : null,
    markupPct: costCents > 0 ? round2((profitCents / costCents) * 100) : null,
  };
}

/** Preço de venda que atinge um markup desejado sobre o custo. */
export function priceForMarkup(costCents: Cents, markupPct: number): Cents {
  return Math.round(costCents * (1 + markupPct / 100));
}

/**
 * Custo médio ponderado depois de uma nova entrada de estoque.
 * Ex.: 10 un a R$ 5,00 em estoque + 10 un compradas a R$ 7,00 = R$ 6,00.
 */
export function weightedAverageCost(
  currentQty: number,
  currentAvgCents: Cents,
  incomingQty: number,
  incomingUnitCents: Cents,
): Cents {
  const qty = Math.max(currentQty, 0) + incomingQty;
  if (qty <= 0) return incomingUnitCents;
  return Math.round(
    (Math.max(currentQty, 0) * currentAvgCents + incomingQty * incomingUnitCents) / qty,
  );
}
