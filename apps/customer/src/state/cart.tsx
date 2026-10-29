import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { OptionSelection, PricedOption, SaleUnit } from '@hiper/shared';

/**
 * Carrinho de uma loja só, guardado no aparelho. Os preços aqui servem para
 * mostrar o total; o servidor recalcula tudo ao criar o pedido.
 */

export interface CartLine {
  key: string;
  productId: string;
  name: string;
  photo: string | null;
  saleUnit: SaleUnit;
  quantity: number;
  selections: OptionSelection[];
  options: PricedOption[];
  unitPriceCents: number;
  notes: string;
}

export interface CartStore {
  tenantId: string;
  slug: string;
  name: string;
}

interface Cart {
  store: CartStore | null;
  lines: CartLine[];
}

interface CartApi extends Cart {
  count: number;
  subtotalCents: number;
  /** false quando o carrinho já tem itens de outra loja. */
  canAddFrom: (tenantId: string) => boolean;
  add: (store: CartStore, line: Omit<CartLine, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  replacePrices: (prices: Map<string, number>) => void;
  clear: () => void;
}

const STORAGE_KEY = 'hiper.cart.v1';
const empty: Cart = { store: null, lines: [] };
const CartContext = createContext<CartApi | null>(null);

function lineKey(productId: string, selections: OptionSelection[], notes: string): string {
  const opts = [...selections]
    .map((s) => `${s.groupId}:${[...s.optionIds].sort().join(',')}`)
    .sort()
    .join('|');
  return `${productId}#${opts}#${notes.trim()}`;
}

export function lineTotalCents(line: Pick<CartLine, 'unitPriceCents' | 'quantity'>): number {
  return Math.round(line.unitPriceCents * line.quantity);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(empty);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setCart(JSON.parse(raw) as Cart))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cart)).catch(() => {});
  }, [cart, loaded]);

  const api = useMemo<CartApi>(() => {
    const subtotalCents = cart.lines.reduce((s, l) => s + lineTotalCents(l), 0);
    return {
      ...cart,
      count: cart.lines.reduce(
        (s, l) => s + (l.saleUnit === 'kg' || l.saleUnit === 'l' ? 1 : l.quantity),
        0,
      ),
      subtotalCents,
      canAddFrom: (tenantId) =>
        !cart.store || cart.store.tenantId === tenantId || cart.lines.length === 0,
      add: (store, line) =>
        setCart((c) => {
          const base = c.store?.tenantId === store.tenantId ? c : { store, lines: [] };
          const key = lineKey(line.productId, line.selections, line.notes);
          const existing = base.lines.find((l) => l.key === key);
          const lines = existing
            ? base.lines.map((l) =>
                l.key === key
                  ? { ...l, quantity: Math.round((l.quantity + line.quantity) * 1000) / 1000 }
                  : l,
              )
            : [...base.lines, { ...line, key }];
          return { store, lines };
        }),
      setQuantity: (key, quantity) =>
        setCart((c) => {
          const lines =
            quantity <= 0
              ? c.lines.filter((l) => l.key !== key)
              : c.lines.map((l) => (l.key === key ? { ...l, quantity } : l));
          return lines.length ? { ...c, lines } : empty;
        }),
      replacePrices: (prices) =>
        setCart((c) => ({
          ...c,
          lines: c.lines.map((l) =>
            prices.has(l.key) ? { ...l, unitPriceCents: prices.get(l.key)! } : l,
          ),
        })),
      clear: () => setCart(empty),
    };
  }, [cart]);

  return <CartContext value={api}>{children}</CartContext>;
}

export function useCart(): CartApi {
  const ctx = use(CartContext);
  if (!ctx) throw new Error('useCart fora do CartProvider');
  return ctx;
}
