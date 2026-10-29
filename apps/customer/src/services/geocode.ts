import type { LatLng } from '@hiper/shared';
import { env } from '@/lib/env';

/**
 * Ponto no mapa a partir do endereço, pelo Nominatim (OpenStreetMap). O
 * servidor público pede no máximo 1 consulta por segundo; em produção use uma
 * instância própria ou o Photon. O cliente ajusta o pino no mapa depois.
 */
export async function geocodeAddress(a: {
  street: string;
  number: string;
  city: string;
  state: string;
  cep: string;
}): Promise<LatLng | null> {
  const attempts: Array<Record<string, string>> = [
    { street: `${a.number} ${a.street}`, city: a.city, state: a.state, country: 'Brasil' },
    { postalcode: a.cep, country: 'Brasil' },
  ];
  for (const params of attempts) {
    try {
      const qs = new URLSearchParams({ ...params, format: 'json', limit: '1' });
      const res = await fetch(`${env.nominatimUrl}/search?${qs}`, {
        headers: { 'Accept-Language': 'pt-BR' },
      });
      if (!res.ok) continue;
      const [first] = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (first) return { lat: Number(first.lat), lng: Number(first.lon) };
    } catch {
      // Sem rede ou bloqueado: tenta a próxima forma e depois deixa o cliente marcar.
    }
  }
  // Demonstração sem rede: um ponto em Pinheiros, que o cliente ajusta no mapa.
  if (env.dataSource === 'demo')
    return {
      lat: -23.5641 + (Math.random() - 0.5) * 0.004,
      lng: -46.6895 + (Math.random() - 0.5) * 0.004,
    };
  return null;
}
