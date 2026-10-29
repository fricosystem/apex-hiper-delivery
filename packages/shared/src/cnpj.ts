/** CNPJ: 14 dígitos, os dois últimos verificadores (módulo 11). */

export function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, '');
}

function cnpjDigit(base: string): number {
  const weights =
    base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(base[i]), 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = normalizeCnpj(raw);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const first = cnpjDigit(cnpj.slice(0, 12));
  const second = cnpjDigit(cnpj.slice(0, 12) + first);
  return cnpj.endsWith(`${first}${second}`);
}

export function formatCnpj(raw: string): string {
  const c = normalizeCnpj(raw);
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
