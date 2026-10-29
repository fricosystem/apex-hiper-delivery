import {
  deliveryFeeCents,
  describeLineProblem,
  isOpenAt,
  normalizeText,
  priceLine,
  searchTerm,
  type CreateOrderInput,
  type OrderStatus,
  type SavedAddressInput,
  type UserProfileInput,
} from '@hiper/shared';
import { pointAlong, route } from '@/services/routing';
import { demoAddress, demoStores } from './demo-seed';
import {
  DataError,
  type AddressEntry,
  type CatalogEntry,
  type DataSource,
  type OrderEntry,
  type PositionEntry,
  type SessionUser,
} from './types';

/**
 * Fonte de dados de demonstração: tudo em memória, com as mesmas regras de
 * preço e frete do servidor (pacote compartilhado). O pedido anda sozinho
 * pelos status e o entregador percorre a rota no mapa, para o preview mostrar
 * o acompanhamento sem a loja e o entregador reais.
 */

const PAGE = 24;
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

type Listener<T> = (value: T) => void;

class Channel<T> {
  private listeners = new Map<string, Set<Listener<T>>>();
  on(key: string, fn: Listener<T>): () => void {
    const set = this.listeners.get(key) ?? new Set();
    set.add(fn);
    this.listeners.set(key, set);
    return () => set.delete(fn);
  }
  emit(key: string, value: T) {
    for (const fn of this.listeners.get(key) ?? []) fn(value);
  }
}

/** Tempo, em segundos desde o pedido, em que cada status chega na demonstração. */
const SCRIPT: Array<[number, OrderStatus]> = [
  [5, 'accepted'],
  [10, 'preparing'],
  [18, 'dispatched'],
  [58, 'delivered'],
];
const PICKUP_SCRIPT: Array<[number, OrderStatus]> = [
  [5, 'accepted'],
  [10, 'preparing'],
  [25, 'ready'],
];

export function createDemoSource(): DataSource {
  const seeds = demoStores();
  const stores = seeds.map((s) => s.store);
  const byTenant = new Map(seeds.map((s) => [s.store.tenantId, s]));

  let user: SessionUser | null = null;
  const authListeners = new Set<Listener<SessionUser | null>>();
  const setUser = (u: SessionUser | null) => {
    user = u;
    for (const fn of authListeners) fn(u);
  };

  const profiles = new Map<string, UserProfileInput>();
  const addresses = new Map<string, AddressEntry[]>();
  const orders = new Map<string, OrderEntry>();
  const orderChannel = new Channel<OrderEntry | null>();
  const positionChannel = new Channel<PositionEntry | null>();
  const positions = new Map<string, PositionEntry>();
  let orderNumber = 1041;

  function seedAccount(u: SessionUser) {
    if (!addresses.has(u.uid)) addresses.set(u.uid, [{ ...demoAddress, id: 'casa' }]);
    if (!profiles.has(u.uid)) {
      profiles.set(u.uid, {
        displayName: u.displayName ?? 'Cliente',
        phone: '11912345678',
        marketingOptIn: false,
      });
    }
    // Dois pedidos antigos para o histórico não começar vazio.
    if (![...orders.values()].some((o) => o.customerUid === u.uid)) {
      const burger = byTenant.get('demo-burger')!;
      const mercado = byTenant.get('demo-mercado')!;
      const past = (days: number) => Date.now() - days * 86_400_000;
      const base = {
        customerUid: u.uid,
        customerName: u.displayName ?? 'Cliente',
        customerPhone: '11912345678',
        fulfillment: 'delivery' as const,
        address: demoAddress,
        notes: '',
        courier: { name: 'Marcos', phone: null, vehicle: 'Moto' },
        clientRequestId: 'seed',
        payment: {
          method: 'card_on_delivery' as const,
          changeForCents: null,
          status: 'paid' as const,
        },
      };
      orders.set('seed-1', {
        ...base,
        id: 'seed-1',
        tenantId: burger.store.tenantId,
        storeSlug: burger.store.slug,
        storeName: burger.store.tradeName,
        number: 1027,
        status: 'delivered',
        history: [{ status: 'delivered', atMs: past(3) }],
        distanceKm: 1.8,
        etaMinutes: 40,
        lines: [
          {
            productId: 'classico',
            name: 'Clássico da Vila',
            photo: 'emoji:🍔',
            quantity: 2,
            saleUnit: 'un',
            unitPriceCents: 3290,
            totalCents: 6580,
            options: [],
            notes: '',
          },
          {
            productId: 'fritas',
            name: 'Batata frita',
            photo: 'emoji:🍟',
            quantity: 1,
            saleUnit: 'un',
            unitPriceCents: 1890,
            totalCents: 1890,
            options: [],
            notes: '',
          },
        ],
        subtotalCents: 8470,
        deliveryFeeCents: 590,
        totalCents: 9060,
        storeLocation: burger.store.address!.location,
        createdAtMs: past(3),
      });
      orders.set('seed-2', {
        ...base,
        id: 'seed-2',
        tenantId: mercado.store.tenantId,
        storeSlug: mercado.store.slug,
        storeName: mercado.store.tradeName,
        number: 1009,
        status: 'delivered',
        history: [{ status: 'delivered', atMs: past(9) }],
        distanceKm: 1.2,
        etaMinutes: 70,
        lines: [
          {
            productId: 'arroz',
            name: 'Arroz agulhinha tipo 1 5 kg',
            photo: 'emoji:🍚',
            quantity: 1,
            saleUnit: 'un',
            unitPriceCents: 2790,
            totalCents: 2790,
            options: [],
            notes: '',
          },
          {
            productId: 'cafe',
            name: 'Café torrado e moído 500 g',
            photo: 'emoji:☕',
            quantity: 2,
            saleUnit: 'un',
            unitPriceCents: 1590,
            totalCents: 3180,
            options: [],
            notes: '',
          },
        ],
        subtotalCents: 5970,
        deliveryFeeCents: 790,
        totalCents: 6760,
        storeLocation: mercado.store.address!.location,
        createdAtMs: past(9),
      });
    }
  }

  function signInAs(email: string, name?: string) {
    const uid = `demo-${normalizeText(email).replace(/\s/g, '-')}`;
    const displayName = name ?? profiles.get(uid)?.displayName ?? email.split('@')[0] ?? 'Cliente';
    const u = { uid, email, displayName };
    seedAccount(u);
    setUser(u);
  }

  function requireUser(): SessionUser {
    if (!user) throw new DataError('Faça login para continuar.', 'functions/unauthenticated');
    return user;
  }

  function updateOrder(id: string, status: OrderStatus) {
    const order = orders.get(id);
    if (!order) return;
    const next: OrderEntry = {
      ...order,
      status,
      history: [...order.history, { status, atMs: Date.now() }],
      courier:
        status === 'dispatched'
          ? { name: 'Marcos Silva', phone: '11900001111', vehicle: 'Moto' }
          : order.courier,
    };
    orders.set(id, next);
    orderChannel.emit(id, next);
  }

  async function runScript(order: OrderEntry) {
    const script = order.fulfillment === 'pickup' ? PICKUP_SCRIPT : SCRIPT;
    const start = Date.now();
    for (const [sec, status] of script) {
      setTimeout(() => updateOrder(order.id, status), sec * 1000);
    }
    if (order.fulfillment !== 'delivery' || !order.storeLocation || !order.address) return;
    const path = await route(order.storeLocation, order.address.location);
    const [departSec, arriveSec] = [SCRIPT[2]![0], SCRIPT[3]![0]];
    const timer = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      if (elapsed < departSec) return;
      const fraction = Math.min(1, (elapsed - departSec) / (arriveSec - departSec - 2));
      const p = pointAlong(path.coordinates, fraction);
      const pos = { lat: p.lat, lng: p.lng, heading: null, updatedAtMs: Date.now() };
      positions.set(order.id, pos);
      positionChannel.emit(order.id, pos);
      if (elapsed >= arriveSec) clearInterval(timer);
    }, 1500);
  }

  return {
    kind: 'demo',

    onAuthChanged(cb) {
      authListeners.add(cb);
      cb(user);
      return () => authListeners.delete(cb);
    },
    async signIn(email, password) {
      await wait();
      if (!email.includes('@')) throw new DataError('E-mail inválido.', 'auth/invalid-email');
      if (password.length < 6)
        throw new DataError('E-mail ou senha incorretos.', 'auth/invalid-credential');
      signInAs(email);
    },
    async signUp(name, email, password) {
      await wait();
      if (password.length < 6)
        throw new DataError('Use uma senha com pelo menos 6 caracteres.', 'auth/weak-password');
      signInAs(email, name);
    },
    async signInWithGoogle() {
      await wait();
      signInAs('ana.souza@gmail.com', 'Ana Souza');
    },
    async sendPasswordReset() {
      await wait();
    },
    async signOut() {
      setUser(null);
    },
    async deleteAccount() {
      const u = requireUser();
      addresses.delete(u.uid);
      profiles.delete(u.uid);
      for (const [id, o] of orders) {
        if (o.customerUid === u.uid)
          orders.set(id, { ...o, customerName: 'Conta excluída', customerPhone: '' });
      }
      setUser(null);
    },
    async getProfile(uid) {
      return profiles.get(uid) ?? null;
    },
    async saveProfile(uid, profile) {
      await wait();
      profiles.set(uid, profile);
      if (user?.uid === uid) setUser({ ...user, displayName: profile.displayName });
    },

    async listStores() {
      await wait();
      return { items: stores, next: null };
    },
    async getStore(slug) {
      await wait(150);
      return stores.find((s) => s.slug === slug) ?? null;
    },
    async listCategories(tenantId) {
      return byTenant.get(tenantId)?.categories ?? [];
    },
    async listCatalog(tenantId, q) {
      await wait(200);
      let items = byTenant.get(tenantId)?.items ?? [];
      const term = q.search ? searchTerm(q.search) : null;
      if (term) items = items.filter((i) => i.searchKeywords.includes(term));
      else if (q.categoryId) items = items.filter((i) => i.categoryId === q.categoryId);
      const start = typeof q.after === 'number' ? q.after : 0;
      const size = q.pageSize ?? PAGE;
      const slice = items.slice(start, start + size);
      return { items: slice, next: start + size < items.length ? start + size : null };
    },
    async getCatalogItems(tenantId, ids) {
      const items = byTenant.get(tenantId)?.items ?? [];
      return new Map(
        items.filter((i) => ids.includes(i.id)).map((i) => [i.id, i] as [string, CatalogEntry]),
      );
    },
    photoUrl: (path) => path,

    async createOrder(input: CreateOrderInput) {
      await wait(600);
      const u = requireUser();
      const seed = byTenant.get(input.tenantId);
      if (!seed)
        throw new DataError(
          'Esta loja não está recebendo pedidos.',
          'functions/failed-precondition',
        );
      const { store, items } = seed;
      if (!store.openingHours || !isOpenAt(store.openingHours, new Date())) {
        throw new DataError('A loja está fechada agora.', 'functions/failed-precondition');
      }
      const lines = input.lines.map((line) => {
        const catalog = items.find((i) => i.id === line.productId);
        if (!catalog)
          throw new DataError(
            'Um produto do carrinho saiu da loja.',
            'functions/failed-precondition',
          );
        const priced = priceLine(catalog, line.quantity, line.options);
        if (!priced.ok) {
          throw new DataError(
            `${catalog.name}: ${describeLineProblem(priced.problems[0]!)}`,
            'functions/failed-precondition',
          );
        }
        return {
          productId: catalog.id,
          name: catalog.name,
          photo: catalog.photos[0] ?? null,
          quantity: line.quantity,
          saleUnit: catalog.saleUnit,
          unitPriceCents: priced.unitPriceCents,
          totalCents: priced.totalCents,
          options: priced.options,
          notes: line.notes,
        };
      });
      const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);
      const delivery = store.delivery!;
      if (subtotalCents < delivery.minOrderCents) {
        throw new DataError(
          'O pedido não atingiu o valor mínimo da loja.',
          'functions/failed-precondition',
        );
      }
      let fee = 0;
      let distanceKm: number | null = null;
      let eta = store.prepTimeMinutes ?? 0;
      if (input.fulfillment === 'delivery') {
        const r = await route(store.address!.location!, input.address!.location);
        distanceKm = r.distanceKm;
        const computed = deliveryFeeCents(delivery, { distanceKm }, subtotalCents);
        if (computed === null) {
          throw new DataError(
            'Seu endereço está fora da área de entrega da loja.',
            'functions/out-of-range',
          );
        }
        fee = computed;
        eta += delivery.radiusTiers.find((t) => distanceKm! <= t.upToKm)?.etaMinutes ?? 0;
      }
      const totalCents = subtotalCents + fee;
      if (totalCents !== input.expectedTotalCents) {
        throw new DataError('Os valores mudaram. Confira o pedido de novo.', 'functions/aborted', {
          totalCents,
          subtotalCents,
          deliveryFeeCents: fee,
        });
      }
      if (input.payment.method === 'pix') {
        throw new DataError(
          'Pagamento por Pix ainda não está disponível.',
          'functions/unimplemented',
        );
      }
      const existing = [...orders.values()].find(
        (o) => o.customerUid === u.uid && o.clientRequestId === input.clientRequestId,
      );
      if (existing)
        return { orderId: existing.id, number: existing.number, totalCents: existing.totalCents };

      const id = `demo-${Date.now().toString(36)}`;
      const order: OrderEntry = {
        id,
        tenantId: store.tenantId,
        storeSlug: store.slug,
        storeName: store.tradeName,
        number: ++orderNumber,
        customerUid: u.uid,
        customerName: profiles.get(u.uid)?.displayName ?? u.displayName ?? 'Cliente',
        customerPhone: input.customerPhone,
        status: 'pending',
        history: [{ status: 'pending', atMs: Date.now() }],
        fulfillment: input.fulfillment,
        address: input.fulfillment === 'delivery' ? input.address : null,
        distanceKm,
        etaMinutes: eta,
        lines,
        subtotalCents,
        deliveryFeeCents: fee,
        totalCents,
        payment: {
          method: input.payment.method,
          changeForCents: input.payment.method === 'cash' ? input.payment.changeForCents : null,
          status: 'pending',
        },
        notes: input.notes,
        courier: null,
        storeLocation: store.address!.location,
        clientRequestId: input.clientRequestId,
        createdAtMs: Date.now(),
      };
      orders.set(id, order);
      void runScript(order);
      return { orderId: id, number: order.number, totalCents };
    },
    async listMyOrders(uid) {
      await wait();
      const mine = [...orders.values()].filter((o) => o.customerUid === uid);
      return { items: mine.sort((a, b) => b.createdAtMs - a.createdAtMs), next: null };
    },
    async getOrder(_tenantId, orderId) {
      return orders.get(orderId) ?? null;
    },
    watchOrder(_tenantId, orderId, cb) {
      cb(orders.get(orderId) ?? null);
      return orderChannel.on(orderId, cb);
    },
    watchCourierPosition(_tenantId, orderId, cb) {
      cb(positions.get(orderId) ?? null);
      return positionChannel.on(orderId, cb);
    },

    async listAddresses(uid) {
      return addresses.get(uid) ?? [];
    },
    async saveAddress(uid, address: SavedAddressInput, id) {
      await wait();
      const list = addresses.get(uid) ?? [];
      const newId = id ?? `end-${Date.now().toString(36)}`;
      addresses.set(uid, [...list.filter((a) => a.id !== newId), { ...address, id: newId }]);
      return newId;
    },
    async deleteAddress(uid, id) {
      addresses.set(
        uid,
        (addresses.get(uid) ?? []).filter((a) => a.id !== id),
      );
    },
  };
}
