import { z } from 'zod';
import type { PricedOption } from '../cart';
import { addressSchema, centsSchema, phoneSchema, type TimestampLike } from './common';

/**
 * Pedido do cliente: tenants/{tenantId}/orders/{orderId}. Criado só pela
 * Function createOrder, que recalcula preços e frete a partir do catálogo e
 * das regras da loja. O cliente lê os próprios pedidos; a equipe da loja lê
 * os da empresa dela.
 */

export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'dispatched',
  'delivered',
  'cancelled',
  'rejected',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Aguardando a loja',
  accepted: 'Pedido aceito',
  preparing: 'Em preparo',
  ready: 'Pronto',
  dispatched: 'Saiu para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  rejected: 'Recusado pela loja',
};

/** Status em que o pedido ainda anda; só nesses o app escuta em tempo real. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'dispatched',
];

export function isOrderActive(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status);
}

/** Passos mostrados na linha do tempo do acompanhamento. */
export const ORDER_TIMELINE: Record<'delivery' | 'pickup', readonly OrderStatus[]> = {
  delivery: ['pending', 'accepted', 'preparing', 'dispatched', 'delivered'],
  pickup: ['pending', 'accepted', 'preparing', 'ready', 'delivered'],
};

export const PAYMENT_METHODS = ['pix', 'cash', 'card_on_delivery'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  cash: 'Dinheiro na entrega',
  card_on_delivery: 'Cartão na entrega (maquininha)',
};

export const FULFILLMENTS = ['delivery', 'pickup'] as const;
export type Fulfillment = (typeof FULFILLMENTS)[number];

export const orderLineInputSchema = z.object({
  productId: z.string().min(1).max(128),
  quantity: z.number().positive().max(1000),
  options: z
    .array(
      z.object({
        groupId: z.string().min(1).max(40),
        optionIds: z.array(z.string().min(1).max(40)).max(50),
      }),
    )
    .max(20)
    .default([]),
  notes: z.string().trim().max(140).default(''),
});
export type OrderLineInput = z.infer<typeof orderLineInputSchema>;

/** Endereço de entrega com o ponto no mapa obrigatório (frete e corrida). */
export const deliveryAddressSchema = addressSchema.extend({
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  reference: z.string().trim().max(120).nullable().default(null),
});
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

export const createOrderInputSchema = z
  .object({
    tenantId: z.string().min(1).max(128),
    lines: z.array(orderLineInputSchema).min(1).max(100),
    fulfillment: z.enum(FULFILLMENTS),
    address: deliveryAddressSchema.nullable().default(null),
    payment: z.object({
      method: z.enum(PAYMENT_METHODS),
      /** Troco para quanto, só no dinheiro. */
      changeForCents: centsSchema.nullable().default(null),
    }),
    customerPhone: phoneSchema,
    notes: z.string().trim().max(300).default(''),
    /** Total que o cliente viu; se o servidor calcular outro, o pedido é recusado. */
    expectedTotalCents: centsSchema,
    /** Gerado pelo app para não duplicar o pedido em caso de nova tentativa. */
    clientRequestId: z.string().min(8).max(64),
  })
  .refine((o) => o.fulfillment === 'pickup' || o.address !== null, {
    message: 'Informe o endereço de entrega',
    path: ['address'],
  });
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export interface OrderLine {
  productId: string;
  name: string;
  photo: string | null;
  quantity: number;
  saleUnit: string;
  unitPriceCents: number;
  totalCents: number;
  options: PricedOption[];
  notes: string;
}

export interface OrderStatusChange {
  status: OrderStatus;
  atMs: number;
}

/** tenants/{tenantId}/orders/{orderId} */
export interface Order {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  /** Número curto mostrado ao cliente e à loja (#1042). */
  number: number;
  customerUid: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  history: OrderStatusChange[];
  fulfillment: Fulfillment;
  address: DeliveryAddress | null;
  /** Distância da loja ao cliente usada no frete. */
  distanceKm: number | null;
  etaMinutes: number | null;
  lines: OrderLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  payment: {
    method: PaymentMethod;
    changeForCents: number | null;
    status: 'pending' | 'paid' | 'refunded';
  };
  notes: string;
  /** Entregador da corrida, preenchido quando a loja despacha. */
  courier: { name: string; phone: string | null; vehicle: string | null } | null;
  /** Ponto da loja, para o mapa do acompanhamento. */
  storeLocation: { lat: number; lng: number } | null;
  clientRequestId: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

/**
 * tenants/{tenantId}/orders/{orderId}/live/position: posição do entregador
 * durante a entrega. Atualizada a cada 15 segundos ou 50 metros e escutada
 * pelo cliente só na tela de acompanhamento.
 */
export interface CourierPosition {
  /** Repetido aqui para a regra não precisar ler o pedido. */
  customerUid: string;
  lat: number;
  lng: number;
  heading: number | null;
  updatedAt: TimestampLike;
}

/** users/{uid}/addresses/{addressId}: endereços salvos do cliente. */
export const savedAddressInputSchema = deliveryAddressSchema.extend({
  label: z.string().trim().min(1).max(30),
});
export type SavedAddressInput = z.infer<typeof savedAddressInputSchema>;
export type SavedAddress = SavedAddressInput & {
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

export const orderPaths = {
  orders: (tenantId: string) => `tenants/${tenantId}/orders`,
  order: (tenantId: string, orderId: string) => `tenants/${tenantId}/orders/${orderId}`,
  courierPosition: (tenantId: string, orderId: string) =>
    `tenants/${tenantId}/orders/${orderId}/live/position`,
  /** Contador do número curto dos pedidos da loja. */
  orderCounter: (tenantId: string) => `tenants/${tenantId}/counters/orders`,
  /** Categorias visíveis na vitrine, geradas pela Function syncPublicCategories. */
  publicCategories: (tenantId: string) => `tenants/${tenantId}/publicCategories`,
  publicCategory: (tenantId: string, id: string) => `tenants/${tenantId}/publicCategories/${id}`,
  addresses: (uid: string) => `users/${uid}/addresses`,
  address: (uid: string, id: string) => `users/${uid}/addresses/${id}`,
} as const;

/** tenants/{tenantId}/publicCategories/{categoryId} */
export interface PublicCategory {
  name: string;
  parentId: string | null;
  displayOrder: number;
}
