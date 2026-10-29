import { isOpenAt, WEEKDAYS, type OpeningHours } from '@hiper/shared';
import type { Storefront } from '@/data';

export interface StoreStatus {
  open: boolean;
  /** "Aberto agora", "Abre hoje às 18:00", "Fechado". */
  label: string;
  /** "20–45 min" a partir do preparo e das faixas de entrega. */
  eta: string | null;
  /** Menor taxa de entrega cadastrada. */
  feeFromCents: number | null;
}

function nextOpening(hours: OpeningHours, now: Date): string | null {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(now);
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  for (let offset = 0; offset < 7; offset++) {
    const intervals = [...(hours[WEEKDAYS[(today + offset) % 7]!] ?? [])].sort((a, b) =>
      a.open.localeCompare(b.open),
    );
    const next = intervals.find((i) => offset > 0 || i.open > time);
    if (next) {
      if (offset === 0) return `Abre hoje às ${next.open}`;
      if (offset === 1) return `Abre amanhã às ${next.open}`;
      const names = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
      return `Abre ${names[(today + offset) % 7]} às ${next.open}`;
    }
  }
  return null;
}

export function storeStatus(store: Storefront, now = new Date()): StoreStatus {
  const configured = !!store.openingHours && !!store.delivery;
  const open = store.open && configured && isOpenAt(store.openingHours!, now);
  let label = 'Aberto agora';
  if (!store.open) label = 'Indisponível';
  else if (!configured) label = 'Em configuração';
  else if (!open) label = nextOpening(store.openingHours!, now) ?? 'Fechado';

  let eta: string | null = null;
  let feeFromCents: number | null = null;
  const tiers =
    store.delivery?.mode === 'district' ? store.delivery.districts : store.delivery?.radiusTiers;
  if (tiers && tiers.length > 0) {
    const prep = store.prepTimeMinutes ?? 0;
    const etas = tiers.map((t) => t.etaMinutes + prep);
    const [lo, hi] = [Math.min(...etas), Math.max(...etas)];
    eta = lo === hi ? `${lo} min` : `${lo}–${hi} min`;
    feeFromCents = Math.min(...tiers.map((t) => t.feeCents));
  }
  return { open, label, eta, feeFromCents };
}

export const SEGMENT_SHORT: Record<string, string> = {
  restaurant: 'Restaurante',
  bakery: 'Açaí e doces',
  grocery: 'Mercado',
  pharmacy: 'Farmácia',
  retail: 'Loja',
  other: 'Loja',
};
