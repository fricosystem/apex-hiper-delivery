/**
 * GTIN (código de barras EAN-8, UPC-A/GTIN-12, EAN-13, GTIN-14).
 * O último dígito é verificador, calculado pelo módulo 10 com pesos 3 e 1
 * a partir da direita.
 */

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** Remove espaços, hífens e pontos que leitores e planilhas costumam trazer. */
export function normalizeGtin(raw: string): string {
  return raw.replace(/[\s.-]/g, '');
}

export function gtinCheckDigit(withoutCheckDigit: string): number {
  let sum = 0;
  for (let i = 0; i < withoutCheckDigit.length; i++) {
    const digit = Number(withoutCheckDigit[withoutCheckDigit.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(raw: string): boolean {
  const gtin = normalizeGtin(raw);
  if (!/^\d+$/.test(gtin) || !GTIN_LENGTHS.has(gtin.length)) return false;
  return gtinCheckDigit(gtin.slice(0, -1)) === Number(gtin[gtin.length - 1]);
}

/**
 * Códigos internos de balança e de uso restrito (prefixos 2xx no EAN-13)
 * são válidos mas não identificam o produto fora da loja, então não servem
 * para buscar dados em bases públicas como o Open Food Facts.
 */
export function isRestrictedCirculationGtin(raw: string): boolean {
  const gtin = normalizeGtin(raw);
  return gtin.length === 13 && gtin.startsWith('2');
}
