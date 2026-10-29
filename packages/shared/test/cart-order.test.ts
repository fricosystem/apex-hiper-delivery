import { describe, expect, it } from 'vitest';
import {
  createOrderInputSchema,
  deliveryFeeCents,
  estimateRoadKm,
  haversineKm,
  isOpenAt,
  priceLine,
  type CatalogItem,
  type DeliverySettings,
  type OpeningHours,
} from '../src';

const burger: Pick<
  CatalogItem,
  'salePriceCents' | 'promo' | 'optionGroups' | 'available' | 'maxPerOrder' | 'saleUnit'
> = {
  salePriceCents: 2500,
  promo: null,
  available: true,
  maxPerOrder: 5,
  saleUnit: 'un',
  optionGroups: [
    {
      id: 'ponto',
      name: 'Ponto da carne',
      min: 1,
      max: 1,
      options: [
        { id: 'mal', name: 'Mal passado', priceDeltaCents: 0, available: true },
        { id: 'bem', name: 'Bem passado', priceDeltaCents: 0, available: true },
      ],
    },
    {
      id: 'extras',
      name: 'Adicionais',
      min: 0,
      max: 2,
      options: [
        { id: 'bacon', name: 'Bacon', priceDeltaCents: 400, available: true },
        { id: 'ovo', name: 'Ovo', priceDeltaCents: 250, available: true },
        { id: 'cheddar', name: 'Cheddar', priceDeltaCents: 300, available: false },
      ],
    },
  ],
};

describe('preço do item do carrinho', () => {
  it('soma variações e adicionais', () => {
    const line = priceLine(burger, 2, [
      { groupId: 'ponto', optionIds: ['bem'] },
      { groupId: 'extras', optionIds: ['bacon', 'ovo'] },
    ]);
    expect(line.ok && line.unitPriceCents).toBe(3150);
    expect(line.ok && line.totalCents).toBe(6300);
  });

  it('exige grupo obrigatório e respeita o máximo', () => {
    const noPoint = priceLine(burger, 1, []);
    expect(noPoint.ok).toBe(false);
    expect(!noPoint.ok && noPoint.problems[0]?.code).toBe('too_few_options');

    const tooMany = priceLine(burger, 1, [
      { groupId: 'ponto', optionIds: ['mal'] },
      { groupId: 'extras', optionIds: ['bacon', 'ovo', 'cheddar'] },
    ]);
    expect(!tooMany.ok && tooMany.problems.map((p) => p.code)).toEqual([
      'too_many_options',
      'option_unavailable',
    ]);
  });

  it('usa o preço promocional dentro do período', () => {
    const promo = { ...burger, promo: { priceCents: 2000, startsAtMs: 0, endsAtMs: 10_000 } };
    const line = priceLine(promo, 1, [{ groupId: 'ponto', optionIds: ['mal'] }], 5_000);
    expect(line.ok && line.unitPriceCents).toBe(2000);
    const after = priceLine(promo, 1, [{ groupId: 'ponto', optionIds: ['mal'] }], 20_000);
    expect(after.ok && after.unitPriceCents).toBe(2500);
  });

  it('recusa quantidade acima do máximo e fração em unidade', () => {
    const sel = [{ groupId: 'ponto', optionIds: ['mal'] }];
    expect(priceLine(burger, 6, sel).ok).toBe(false);
    expect(priceLine(burger, 1.5, sel).ok).toBe(false);
    const kg = priceLine({ ...burger, saleUnit: 'kg', optionGroups: [] }, 0.755, []);
    expect(kg.ok && kg.totalCents).toBe(1888);
  });
});

describe('distância e frete', () => {
  const praca = { lat: -23.5505, lng: -46.6333 };
  const paulista = { lat: -23.5614, lng: -46.6559 };

  it('calcula a distância em linha reta e a estimativa de rua', () => {
    expect(haversineKm(praca, paulista)).toBeCloseTo(2.64, 1);
    expect(estimateRoadKm(praca, paulista)).toBeGreaterThan(haversineKm(praca, paulista));
  });

  const settings: DeliverySettings = {
    mode: 'radius',
    radiusTiers: [
      { upToKm: 3, feeCents: 500, etaMinutes: 30 },
      { upToKm: 6, feeCents: 900, etaMinutes: 45 },
    ],
    districts: [],
    minOrderCents: 2000,
    freeShippingAboveCents: 10000,
    pickupEnabled: true,
  };

  it('cobra por faixa, zera acima do frete grátis e recusa fora da área', () => {
    expect(deliveryFeeCents(settings, { distanceKm: 2 }, 3000)).toBe(500);
    expect(deliveryFeeCents(settings, { distanceKm: 5 }, 3000)).toBe(900);
    expect(deliveryFeeCents(settings, { distanceKm: 5 }, 12000)).toBe(0);
    expect(deliveryFeeCents(settings, { distanceKm: 8 }, 3000)).toBeNull();
  });
});

describe('horário de funcionamento', () => {
  const hours: OpeningHours = {
    sun: [],
    mon: [{ open: '18:00', close: '02:00' }],
    tue: [{ open: '11:00', close: '14:00' }],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
  };
  it('considera o intervalo que atravessa a meia-noite', () => {
    // Segunda 23:00 e terça 01:00 em São Paulo (UTC-3).
    expect(isOpenAt(hours, new Date('2026-10-27T02:00:00Z'))).toBe(true);
    expect(isOpenAt(hours, new Date('2026-10-27T04:00:00Z'))).toBe(true);
    expect(isOpenAt(hours, new Date('2026-10-27T06:00:00Z'))).toBe(false);
    expect(isOpenAt(hours, new Date('2026-10-27T15:00:00Z'))).toBe(true);
  });
});

describe('entrada do pedido', () => {
  const base = {
    tenantId: 't1',
    lines: [{ productId: 'p1', quantity: 1 }],
    payment: { method: 'cash' },
    customerPhone: '11999998888',
    expectedTotalCents: 3000,
    clientRequestId: 'abc12345',
  };
  it('exige endereço na entrega e dispensa na retirada', () => {
    expect(createOrderInputSchema.safeParse({ ...base, fulfillment: 'delivery' }).success).toBe(
      false,
    );
    expect(createOrderInputSchema.safeParse({ ...base, fulfillment: 'pickup' }).success).toBe(true);
  });
});
