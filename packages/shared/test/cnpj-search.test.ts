import { describe, expect, it } from 'vitest';
import { buildSearchKeywords, formatCnpj, isValidCnpj, normalizeText, searchTerm } from '../src';

describe('CNPJ', () => {
  it('valida dígitos verificadores', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('123')).toBe(false);
  });

  it('formata', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('busca por palavras-chave', () => {
  it('normaliza acentos e caixa', () => {
    expect(normalizeText('  Pão de Açúcar! ')).toBe('pao de acucar');
  });

  it('gera prefixos das palavras e códigos inteiros', () => {
    const kw = buildSearchKeywords('Pão Francês', 'Padaria', '7891000100103');
    expect(kw).toContain('pa');
    expect(kw).toContain('pao');
    expect(kw).toContain('fran');
    expect(kw).toContain('frances');
    expect(kw).toContain('7891000100103');
    expect(kw).not.toContain('789');
    expect(kw).not.toContain('de');
  });

  it('não repete e respeita o limite', () => {
    const kw = buildSearchKeywords('arroz arroz arroz');
    expect(new Set(kw).size).toBe(kw.length);
    expect(
      buildSearchKeywords('a'.repeat(5000) + ' ' + 'b c d '.repeat(500)).length,
    ).toBeLessThanOrEqual(200);
  });

  it('termo de busca combina com as palavras-chave', () => {
    expect(searchTerm('Açú')).toBe('acu');
    expect(searchTerm('x')).toBeNull();
  });
});
