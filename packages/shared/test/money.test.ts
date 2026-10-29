import { describe, expect, it } from 'vitest';
import {
  computeMargin,
  formatBRL,
  priceForMarkup,
  toCents,
  unitCostCents,
  weightedAverageCost,
} from '../src';

describe('dinheiro em centavos', () => {
  it('converte reais em centavos sem erro de float', () => {
    expect(toCents('12,90')).toBe(1290);
    expect(toCents('1.234,56')).toBe(123456);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(() => toCents('abc')).toThrow();
  });

  it('formata em reais', () => {
    expect(formatBRL(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
  });

  it('soma preço, frete e impostos da compra', () => {
    expect(
      unitCostCents({ purchasePriceCents: 500, purchaseFreightCents: 50, purchaseTaxesCents: 50 }),
    ).toBe(600);
  });

  it('calcula margem e markup', () => {
    expect(computeMargin(1000, 600)).toEqual({ profitCents: 400, marginPct: 40, markupPct: 66.67 });
  });

  it('não divide por zero', () => {
    expect(computeMargin(0, 600)).toEqual({ profitCents: -600, marginPct: null, markupPct: -100 });
    expect(computeMargin(1000, 0)).toEqual({ profitCents: 1000, marginPct: 100, markupPct: null });
  });

  it('sugere preço por markup', () => {
    expect(priceForMarkup(600, 50)).toBe(900);
  });

  it('calcula custo médio ponderado', () => {
    expect(weightedAverageCost(10, 500, 10, 700)).toBe(600);
    expect(weightedAverageCost(0, 0, 5, 700)).toBe(700);
    // Estoque negativo (venda antes da entrada) não distorce o custo.
    expect(weightedAverageCost(-3, 500, 10, 700)).toBe(700);
  });
});
