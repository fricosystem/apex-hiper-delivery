import { describe, expect, it } from 'vitest';
import {
  assignableRoles,
  createTenantInputSchema,
  effectivePriceCents,
  productInputSchema,
  productSearchKeywords,
  toCatalogItem,
  type Product,
} from '../src';

const baseProduct = {
  internalCode: 'X-BURGER',
  name: 'X-Burger',
  pricing: { salePriceCents: 2590 },
};

describe('productInputSchema', () => {
  it('preenche as abas com valores padrão', () => {
    const p = productInputSchema.parse(baseProduct);
    expect(p.stock.tracked).toBe(false);
    expect(p.fiscal.origin).toBe(0);
    expect(p.logistics.temperature).toBe('ambient');
    expect(p.online.visible).toBe(true);
    expect(p.paused).toBe(false);
    expect(p.pricing.promo).toBeNull();
  });

  it('normaliza e valida GTIN, recusando repetidos', () => {
    const ok = productInputSchema.parse({ ...baseProduct, gtins: ['789-1000-100103'] });
    expect(ok.gtins).toEqual(['7891000100103']);
    expect(productInputSchema.safeParse({ ...baseProduct, gtins: ['7891000100104'] }).success).toBe(
      false,
    );
    expect(
      productInputSchema.safeParse({ ...baseProduct, gtins: ['7891000100103', '7891000100103'] })
        .success,
    ).toBe(false);
  });

  it('valida campos fiscais', () => {
    expect(
      productInputSchema.safeParse({ ...baseProduct, fiscal: { ncm: '21069090', cfop: '5102' } })
        .success,
    ).toBe(true);
    expect(productInputSchema.safeParse({ ...baseProduct, fiscal: { ncm: '2106' } }).success).toBe(
      false,
    );
  });

  it('exige promoção menor que o preço e com fim depois do início', () => {
    const promo = (priceCents: number, startsAtMs: number, endsAtMs: number) =>
      productInputSchema.safeParse({
        ...baseProduct,
        pricing: { salePriceCents: 2590, promo: { priceCents, startsAtMs, endsAtMs } },
      }).success;
    expect(promo(1990, 1, 2)).toBe(true);
    expect(promo(2590, 1, 2)).toBe(false);
    expect(promo(1990, 2, 1)).toBe(false);
  });

  it('valida grupos de opções', () => {
    const group = (min: number, max: number) => ({
      id: 'tam',
      name: 'Tamanho',
      min,
      max,
      options: [
        { id: 'p', name: 'P', priceDeltaCents: 0 },
        { id: 'g', name: 'G', priceDeltaCents: 500 },
      ],
    });
    expect(
      productInputSchema.safeParse({ ...baseProduct, optionGroups: [group(1, 1)] }).success,
    ).toBe(true);
    expect(
      productInputSchema.safeParse({ ...baseProduct, optionGroups: [group(2, 1)] }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({ ...baseProduct, optionGroups: [group(0, 3)] }).success,
    ).toBe(false);
  });
});

describe('preço efetivo', () => {
  const pricing = {
    salePriceCents: 1000,
    promo: { priceCents: 800, startsAtMs: 100, endsAtMs: 200 },
  };
  it('usa a promoção só dentro do período', () => {
    expect(effectivePriceCents(pricing, 99)).toBe(1000);
    expect(effectivePriceCents(pricing, 100)).toBe(800);
    expect(effectivePriceCents(pricing, 200)).toBe(1000);
  });
});

describe('toCatalogItem', () => {
  const product = (over: Partial<Product> = {}) => {
    const input = productInputSchema.parse({
      ...baseProduct,
      gtins: ['7891000100103'],
      fiscal: { ncm: '21069090' },
    });
    return { ...input, searchKeywords: productSearchKeywords(input), ...over };
  };

  it('não expõe dados internos', () => {
    const item = toCatalogItem(product())!;
    expect(item).not.toHaveProperty('internalCode');
    expect(item).not.toHaveProperty('fiscal');
    expect(item).not.toHaveProperty('stock');
    expect(JSON.stringify(item)).not.toContain('21069090');
    expect(item.available).toBe(true);
  });

  it('marca indisponível quando pausado ou sem estoque', () => {
    const p = product();
    expect(toCatalogItem({ ...p, paused: true })!.available).toBe(false);
    expect(
      toCatalogItem({ ...p, stock: { ...p.stock, tracked: true, quantity: 0 } })!.available,
    ).toBe(false);
    expect(
      toCatalogItem({ ...p, stock: { ...p.stock, tracked: false, quantity: 0 } })!.available,
    ).toBe(true);
  });

  it('some da loja quando não visível', () => {
    const p = product();
    expect(toCatalogItem({ ...p, online: { ...p.online, visible: false } })).toBeNull();
  });
});

describe('createTenantInputSchema', () => {
  it('aceita cadastro mínimo', () => {
    const t = createTenantInputSchema.parse({
      tradeName: 'Lanche Bom',
      slug: 'lanche-bom',
      segment: 'restaurant',
    });
    expect(t.cnpj).toBeNull();
  });

  it('recusa endereço reservado ou mal formado e CNPJ inválido', () => {
    const base = { tradeName: 'Lanche Bom', segment: 'restaurant' };
    expect(createTenantInputSchema.safeParse({ ...base, slug: 'admin' }).success).toBe(false);
    expect(createTenantInputSchema.safeParse({ ...base, slug: 'Lanche Bom' }).success).toBe(false);
    expect(
      createTenantInputSchema.safeParse({ ...base, slug: 'ok-slug', cnpj: '11222333000182' })
        .success,
    ).toBe(false);
    expect(
      createTenantInputSchema.parse({ ...base, slug: 'ok-slug', cnpj: '11.222.333/0001-81' }).cnpj,
    ).toBe('11222333000181');
  });
});

describe('assignableRoles', () => {
  it('gerente não cria dono nem gerente', () => {
    expect(assignableRoles('manager')).not.toContain('owner');
    expect(assignableRoles('manager')).not.toContain('manager');
    expect(assignableRoles('owner')).toContain('owner');
    expect(assignableRoles('attendant')).toEqual([]);
  });
});
