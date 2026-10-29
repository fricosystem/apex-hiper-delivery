import { formatBRL, SALE_UNIT_LABELS, type SaleUnit } from '@hiper/shared';

export const brl = formatBRL;

/** "2", "0,750 kg" ou "1,5 l" conforme a unidade de venda. */
export function formatQuantity(quantity: number, unit: SaleUnit): string {
  if (unit === 'kg' || unit === 'l') {
    return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: unit === 'kg' ? 3 : 1, maximumFractionDigits: 3 })} ${unit}`;
  }
  return String(quantity);
}

/** Sufixo do preço por unidade: "/kg", "/l" ou nada. */
export function unitSuffix(unit: SaleUnit): string {
  return unit === 'un' ? '' : `/${unit}`;
}

export function unitLabel(unit: SaleUnit): string {
  return SALE_UNIT_LABELS[unit];
}

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(ms));
}

export function formatTime(ms: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(ms));
}

export function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
