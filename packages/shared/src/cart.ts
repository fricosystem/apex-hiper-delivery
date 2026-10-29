import type { CatalogItem } from './models/catalog';
import { effectivePriceCents } from './models/product';

/**
 * Preço de um item do carrinho, com variações e adicionais. O app usa para
 * mostrar o total e a Function createOrder usa a mesma conta para recalcular
 * o pedido a partir do catálogo, sem confiar no valor enviado pelo app.
 */

/** Escolhas do cliente num grupo de opções (tamanho, adicionais). */
export interface OptionSelection {
  groupId: string;
  optionIds: string[];
}

export interface PricedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDeltaCents: number;
}

export type LineProblem =
  | { code: 'unavailable' }
  | { code: 'invalid_quantity' }
  | { code: 'above_max_per_order'; max: number }
  | { code: 'unknown_group'; groupId: string }
  | { code: 'unknown_option'; groupId: string; optionId: string }
  | { code: 'option_unavailable'; groupId: string; optionId: string }
  | { code: 'too_few_options'; groupId: string; min: number }
  | { code: 'too_many_options'; groupId: string; max: number };

export type PricedLine =
  | {
      ok: true;
      unitPriceCents: number;
      totalCents: number;
      options: PricedOption[];
    }
  | { ok: false; problems: LineProblem[] };

type PricingItem = Pick<
  CatalogItem,
  'salePriceCents' | 'promo' | 'optionGroups' | 'available' | 'maxPerOrder' | 'saleUnit'
>;

/** Quantidade aceita: inteira para unidades, até 3 casas para peso e volume. */
export function isValidQuantity(quantity: number, saleUnit: CatalogItem['saleUnit']): boolean {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) return false;
  if (saleUnit === 'kg' || saleUnit === 'l') return Math.round(quantity * 1000) === quantity * 1000;
  return Number.isInteger(quantity);
}

export function priceLine(
  item: PricingItem,
  quantity: number,
  selections: readonly OptionSelection[],
  nowMs: number = Date.now(),
): PricedLine {
  const problems: LineProblem[] = [];
  if (!item.available) problems.push({ code: 'unavailable' });
  if (!isValidQuantity(quantity, item.saleUnit)) problems.push({ code: 'invalid_quantity' });
  if (item.maxPerOrder !== null && quantity > item.maxPerOrder) {
    problems.push({ code: 'above_max_per_order', max: item.maxPerOrder });
  }

  const byGroup = new Map(selections.map((s) => [s.groupId, s.optionIds]));
  for (const groupId of byGroup.keys()) {
    if (!item.optionGroups.some((g) => g.id === groupId)) {
      problems.push({ code: 'unknown_group', groupId });
    }
  }

  const options: PricedOption[] = [];
  for (const group of item.optionGroups) {
    const chosen = [...new Set(byGroup.get(group.id) ?? [])];
    if (chosen.length < group.min) {
      problems.push({ code: 'too_few_options', groupId: group.id, min: group.min });
    }
    if (chosen.length > group.max) {
      problems.push({ code: 'too_many_options', groupId: group.id, max: group.max });
    }
    for (const optionId of chosen) {
      const option = group.options.find((o) => o.id === optionId);
      if (!option) {
        problems.push({ code: 'unknown_option', groupId: group.id, optionId });
        continue;
      }
      if (!option.available) {
        problems.push({ code: 'option_unavailable', groupId: group.id, optionId });
        continue;
      }
      options.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        name: option.name,
        priceDeltaCents: option.priceDeltaCents,
      });
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  const unitPriceCents =
    effectivePriceCents(item, nowMs) + options.reduce((sum, o) => sum + o.priceDeltaCents, 0);
  return {
    ok: true,
    unitPriceCents,
    // Peso fracionado: arredonda o total da linha para o centavo mais próximo.
    totalCents: Math.round(unitPriceCents * quantity),
    options,
  };
}

/** Mensagem curta para o cliente sobre o primeiro problema da linha. */
export function describeLineProblem(problem: LineProblem): string {
  switch (problem.code) {
    case 'unavailable':
      return 'Produto indisponível no momento';
    case 'invalid_quantity':
      return 'Quantidade inválida';
    case 'above_max_per_order':
      return `Máximo de ${problem.max} por pedido`;
    case 'unknown_group':
    case 'unknown_option':
      return 'As opções deste produto mudaram, escolha de novo';
    case 'option_unavailable':
      return 'Uma das opções escolhidas acabou';
    case 'too_few_options':
      return problem.min === 1 ? 'Escolha uma opção' : `Escolha pelo menos ${problem.min} opções`;
    case 'too_many_options':
      return `Escolha no máximo ${problem.max} opções`;
  }
}
