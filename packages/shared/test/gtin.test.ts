import { describe, expect, it } from 'vitest';
import { gtinCheckDigit, isRestrictedCirculationGtin, isValidGtin, normalizeGtin } from '../src';

describe('GTIN/EAN', () => {
  it.each([
    ['7891000100103', 'EAN-13 brasileiro'],
    ['7894900011517', 'EAN-13'],
    ['96385074', 'EAN-8'],
    ['036000291452', 'UPC-A (GTIN-12)'],
    ['17891000100100', 'GTIN-14 de caixa'],
  ])('aceita %s (%s)', (gtin) => {
    expect(isValidGtin(gtin)).toBe(true);
  });

  it('rejeita dígito verificador errado', () => {
    expect(isValidGtin('7891000100104')).toBe(false);
  });

  it('rejeita tamanhos que não existem e letras', () => {
    expect(isValidGtin('123456789')).toBe(false);
    expect(isValidGtin('78910001001A3')).toBe(false);
    expect(isValidGtin('')).toBe(false);
  });

  it('ignora espaços e hífens vindos de leitor ou planilha', () => {
    expect(normalizeGtin(' 789-1000-10010 3 ')).toBe('7891000100103');
    expect(isValidGtin('789 1000 100103')).toBe(true);
  });

  it('calcula o dígito verificador', () => {
    expect(gtinCheckDigit('789100010010')).toBe(3);
    expect(gtinCheckDigit('9638507')).toBe(4);
  });

  it('identifica código interno de balança (prefixo 2)', () => {
    expect(isRestrictedCirculationGtin('2000000000015')).toBe(true);
    expect(isRestrictedCirculationGtin('7891000100103')).toBe(false);
  });
});
