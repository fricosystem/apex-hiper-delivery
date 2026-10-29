import type { Product, OptionGroup, SaleUnit, Temperature } from './product';

/**
 * tenants/{tenantId}/catalog/{productId}: vitrine pública da loja, gravada só
 * pela Function syncCatalog. Leva apenas o que o cliente precisa ver; código
 * interno, dados fiscais, quantidade em estoque e custo nunca entram aqui.
 */
export interface CatalogItem {
  name: string;
  description: string;
  brand: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  photos: string[];
  saleUnit: SaleUnit;
  gtins: string[];
  salePriceCents: number;
  promo: { priceCents: number; startsAtMs: number; endsAtMs: number } | null;
  optionGroups: OptionGroup[];
  /** false quando pausado ou sem estoque. */
  available: boolean;
  displayOrder: number;
  ageRestricted: boolean;
  requiresPrescription: boolean;
  maxPerOrder: number | null;
  /** Usados para calcular o porte do pedido e o veículo da corrida. */
  grossWeightG: number | null;
  dimensionsCm: { length: number; width: number; height: number } | null;
  fragile: boolean;
  temperature: Temperature;
  searchKeywords: string[];
}

type CatalogSource = Omit<Product, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;

/** null quando o produto não deve aparecer na loja. */
export function toCatalogItem(product: CatalogSource): CatalogItem | null {
  if (!product.online.visible) return null;
  const outOfStock = product.stock.tracked && product.stock.quantity <= 0;
  return {
    name: product.name,
    description: product.description,
    brand: product.brand,
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId,
    photos: product.photos,
    saleUnit: product.saleUnit,
    gtins: product.gtins,
    salePriceCents: product.pricing.salePriceCents,
    promo: product.pricing.promo,
    optionGroups: product.optionGroups,
    available: !product.paused && !outOfStock,
    displayOrder: product.online.displayOrder,
    ageRestricted: product.online.ageRestricted,
    requiresPrescription: product.online.requiresPrescription,
    maxPerOrder: product.online.maxPerOrder,
    grossWeightG: product.logistics.grossWeightG,
    dimensionsCm: product.logistics.dimensionsCm,
    fragile: product.logistics.fragile,
    temperature: product.logistics.temperature,
    searchKeywords: product.searchKeywords,
  };
}
