/**
 * O Firestore não tem busca por texto. Cada produto guarda uma lista de
 * prefixos normalizados das palavras do nome, marca e códigos, e a tela
 * consulta com `array-contains` pelo termo digitado.
 */

const MIN_PREFIX = 2;
const MAX_PREFIX = 15;
const MAX_KEYWORDS = 200;

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchKeywords(...parts: Array<string | null | undefined>): string[] {
  const keywords = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const word of normalizeText(part).split(' ')) {
      if (word.length < MIN_PREFIX) continue;
      // Códigos (GTIN, SKU) só batem inteiros; palavras ganham prefixos.
      if (/^\d+$/.test(word)) {
        keywords.add(word);
        continue;
      }
      for (let len = MIN_PREFIX; len <= Math.min(word.length, MAX_PREFIX); len++) {
        keywords.add(word.slice(0, len));
      }
    }
  }
  return [...keywords].slice(0, MAX_KEYWORDS);
}

/** Termo que a tela usa na consulta: a primeira palavra normalizada. */
export function searchTerm(input: string): string | null {
  const word = normalizeText(input).split(' ')[0] ?? '';
  if (word.length < MIN_PREFIX) return null;
  return /^\d+$/.test(word) ? word : word.slice(0, MAX_PREFIX);
}
