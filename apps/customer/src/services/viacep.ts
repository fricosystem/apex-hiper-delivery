import { brazilianStates, type Address } from '@hiper/shared';
import { env } from '@/lib/env';

type CepResult = Pick<Address, 'cep' | 'street' | 'district' | 'city' | 'state'>;

/** CEPs de Pinheiros usados quando o ViaCEP não responde no modo demonstração. */
const DEMO_CEPS: Record<string, Omit<CepResult, 'cep'>> = {
  '05445000': { street: 'Rua Girassol', district: 'Vila Madalena', city: 'São Paulo', state: 'SP' },
  '05416001': {
    street: 'Rua Cardeal Arcoverde',
    district: 'Pinheiros',
    city: 'São Paulo',
    state: 'SP',
  },
  '05422001': {
    street: 'Rua dos Pinheiros',
    district: 'Pinheiros',
    city: 'São Paulo',
    state: 'SP',
  },
  '05433000': {
    street: 'Rua Fradique Coutinho',
    district: 'Pinheiros',
    city: 'São Paulo',
    state: 'SP',
  },
  '05415000': {
    street: 'Rua Teodoro Sampaio',
    district: 'Pinheiros',
    city: 'São Paulo',
    state: 'SP',
  },
  '01310100': {
    street: 'Avenida Paulista',
    district: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  },
};

export async function lookupCep(cep: string): Promise<CepResult | null> {
  const digits = cep.replace(/\D/g, '');
  try {
    return await viaCep(digits);
  } catch (error) {
    const demo = DEMO_CEPS[digits];
    if (env.dataSource === 'demo') return demo ? { cep: digits, ...demo } : null;
    throw error;
  }
}

/** Endereço pelo CEP, pela API gratuita do ViaCEP. */
async function viaCep(cep: string): Promise<CepResult | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;
  const body = (await res.json()) as {
    erro?: boolean | string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (body.erro) return null;
  const state = (brazilianStates as readonly string[]).includes(body.uf ?? '')
    ? (body.uf as Address['state'])
    : null;
  if (!state || !body.localidade) return null;
  return {
    cep: digits,
    street: body.logradouro ?? '',
    district: body.bairro ?? '',
    city: body.localidade,
    state,
  };
}

export function formatCep(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
