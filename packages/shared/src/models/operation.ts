import { z } from 'zod';
import { centsSchema } from './common';

/**
 * PROVISÓRIO: cópia da assinatura definida pelo painel do estabelecimento
 * (Etapa 2). Será substituído pelo arquivo do painel no rebase.
 *
 * Horários de funcionamento, preparo e entrega da loja, gravados em
 * tenants/{tid} e levados a publicStores/{slug} pela Function syncPublicStore.
 */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário no formato HH:MM');

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** close menor que open atravessa a meia-noite (18:00 às 02:00). */
export const openingIntervalSchema = z.object({ open: hhmm, close: hhmm });
export type OpeningInterval = z.infer<typeof openingIntervalSchema>;

export const openingHoursSchema = z.object(
  Object.fromEntries(
    WEEKDAYS.map((d) => [d, z.array(openingIntervalSchema).max(3).default([])]),
  ) as Record<Weekday, z.ZodDefault<z.ZodArray<typeof openingIntervalSchema>>>,
);
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export const deliverySettingsSchema = z.object({
  mode: z.enum(['radius', 'district']),
  radiusTiers: z
    .array(
      z.object({
        upToKm: z.number().positive().max(100),
        feeCents: centsSchema,
        etaMinutes: z.number().int().positive().max(600),
      }),
    )
    .max(20)
    .default([]),
  districts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        feeCents: centsSchema,
        etaMinutes: z.number().int().positive().max(600),
      }),
    )
    .max(200)
    .default([]),
  minOrderCents: centsSchema.default(0),
  freeShippingAboveCents: centsSchema.nullable().default(null),
  pickupEnabled: z.boolean().default(false),
});
export type DeliverySettings = z.infer<typeof deliverySettingsSchema>;

export const tenantOperationSchema = z.object({
  openingHours: openingHoursSchema,
  prepTimeMinutes: z.number().int().min(0).max(600),
  delivery: deliverySettingsSchema,
});
export type TenantOperation = z.infer<typeof tenantOperationSchema>;

function minutesOf(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function localParts(date: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** A loja está aberta neste instante, no fuso da loja? */
export function isOpenAt(
  hours: OpeningHours,
  date: Date,
  timeZone: string = 'America/Sao_Paulo',
): boolean {
  const { day, minutes } = localParts(date, timeZone);
  const today = hours[WEEKDAYS[day]!] ?? [];
  const yesterday = hours[WEEKDAYS[(day + 6) % 7]!] ?? [];
  for (const { open, close } of today) {
    const o = minutesOf(open);
    const c = minutesOf(close);
    if (c > o ? minutes >= o && minutes < c : minutes >= o) return true;
  }
  // Intervalo de ontem que passou da meia-noite.
  for (const { open, close } of yesterday) {
    const o = minutesOf(open);
    const c = minutesOf(close);
    if (c < o && minutes < c) return true;
  }
  return false;
}

/** Taxa de entrega em centavos, ou null fora da área de entrega. */
export function deliveryFeeCents(
  settings: DeliverySettings,
  target: { distanceKm?: number; district?: string },
  orderCents: number,
): number | null {
  let fee: number | null = null;
  if (settings.mode === 'radius' && target.distanceKm !== undefined) {
    const tier = settings.radiusTiers.find((t) => target.distanceKm! <= t.upToKm);
    fee = tier ? tier.feeCents : null;
  } else if (settings.mode === 'district' && target.district) {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const d = settings.districts.find((x) => norm(x.name) === norm(target.district!));
    fee = d ? d.feeCents : null;
  }
  if (fee === null) return null;
  if (settings.freeShippingAboveCents !== null && orderCents >= settings.freeShippingAboveCents) {
    return 0;
  }
  return fee;
}
