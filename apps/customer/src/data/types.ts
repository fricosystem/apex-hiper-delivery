import type {
  Address,
  CatalogItem,
  CourierPosition,
  CreateOrderInput,
  Order,
  PublicCategory,
  PublicStore,
  SavedAddressInput,
  TenantOperation,
  UserProfileInput,
} from '@hiper/shared';

/**
 * Tudo o que as telas leem e gravam passa por esta interface. Há duas
 * implementações: Firebase (produção e emuladores) e demonstração (dados de
 * exemplo em memória, usada no preview web sem backend).
 */

export interface Page<T> {
  items: T[];
  /** Opaco para as telas; null quando não há mais páginas. */
  next: unknown | null;
}

/** publicStores/{slug} com o que a Etapa 2 leva para a vitrine. */
export type Storefront = PublicStore &
  Partial<TenantOperation> & {
    slug: string;
    phone?: string | null;
    address?: Address | null;
  };

export type CatalogEntry = CatalogItem & { id: string };
export type CategoryEntry = PublicCategory & { id: string };
export type OrderEntry = Omit<Order, 'createdAt' | 'updatedAt'> & {
  id: string;
  createdAtMs: number;
};
export type AddressEntry = SavedAddressInput & { id: string };
export type PositionEntry = Pick<CourierPosition, 'lat' | 'lng' | 'heading'> & {
  updatedAtMs: number;
};

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface CatalogQuery {
  categoryId?: string | null;
  search?: string | null;
  after?: unknown | null;
  pageSize?: number;
}

export interface CreateOrderResult {
  orderId: string;
  number: number;
  totalCents: number;
}

/** Erro do servidor com código (functions/aborted etc.) e detalhes. */
export class DataError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface DataSource {
  readonly kind: 'firebase' | 'demo';

  // Conta
  onAuthChanged(cb: (user: SessionUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  /** Google: popup no navegador; no celular entra com o login nativo (Etapa 8, parte 2). */
  signInWithGoogle(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  getProfile(uid: string): Promise<UserProfileInput | null>;
  saveProfile(uid: string, profile: UserProfileInput): Promise<void>;

  // Lojas e catálogo (consultas paginadas, sem tempo real)
  listStores(after?: unknown | null): Promise<Page<Storefront>>;
  getStore(slug: string): Promise<Storefront | null>;
  listCategories(tenantId: string): Promise<CategoryEntry[]>;
  listCatalog(tenantId: string, query: CatalogQuery): Promise<Page<CatalogEntry>>;
  getCatalogItems(tenantId: string, ids: string[]): Promise<Map<string, CatalogEntry>>;
  photoUrl(path: string): string;

  // Pedidos
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  listMyOrders(uid: string, after?: unknown | null): Promise<Page<OrderEntry>>;
  getOrder(tenantId: string, orderId: string): Promise<OrderEntry | null>;
  /** Tempo real num único documento, só enquanto a tela está aberta. */
  watchOrder(tenantId: string, orderId: string, cb: (order: OrderEntry | null) => void): () => void;
  watchCourierPosition(
    tenantId: string,
    orderId: string,
    cb: (pos: PositionEntry | null) => void,
  ): () => void;

  // Endereços
  listAddresses(uid: string): Promise<AddressEntry[]>;
  saveAddress(uid: string, address: SavedAddressInput, id?: string): Promise<string>;
  deleteAddress(uid: string, id: string): Promise<void>;
}
