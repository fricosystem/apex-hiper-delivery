import {
  buildSearchKeywords,
  WEEKDAYS,
  type CatalogItem,
  type OpeningHours,
  type OptionGroup,
  type SaleUnit,
} from '@hiper/shared';
import type { AddressEntry, CatalogEntry, CategoryEntry, Storefront } from './types';

/**
 * Dados de exemplo do modo demonstração: quatro lojas em São Paulo com
 * cardápios completos. As fotos são emojis (prefixo "emoji:") para o preview
 * não depender do Storage.
 */

const allDay: OpeningHours = Object.fromEntries(
  WEEKDAYS.map((d) => [d, [{ open: '00:00', close: '23:59' }]]),
) as OpeningHours;

/** Horário que começa daqui a 3 horas, para mostrar uma loja fechada. */
function closedNow(): OpeningHours {
  const now = new Date();
  const fmt = (h: number) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;
  const local = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  const interval = [{ open: fmt(local + 3), close: fmt(local + 8) }];
  return Object.fromEntries(WEEKDAYS.map((d) => [d, interval])) as OpeningHours;
}

interface ItemSeed {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  price: number;
  promo?: number;
  category: string;
  unit?: SaleUnit;
  groups?: OptionGroup[];
  available?: boolean;
  maxPerOrder?: number;
  ageRestricted?: boolean;
}

function items(seeds: ItemSeed[]): CatalogEntry[] {
  return seeds.map(item);
}

function item(seed: ItemSeed, order: number): CatalogEntry {
  const now = Date.now();
  const entry: CatalogItem = {
    name: seed.name,
    description: seed.description ?? '',
    brand: null,
    categoryId: seed.category,
    subcategoryId: null,
    photos: [`emoji:${seed.emoji}`],
    saleUnit: seed.unit ?? 'un',
    gtins: [],
    salePriceCents: seed.price,
    promo: seed.promo
      ? { priceCents: seed.promo, startsAtMs: now - 86_400_000, endsAtMs: now + 7 * 86_400_000 }
      : null,
    optionGroups: seed.groups ?? [],
    available: seed.available ?? true,
    displayOrder: order,
    ageRestricted: seed.ageRestricted ?? false,
    requiresPrescription: false,
    maxPerOrder: seed.maxPerOrder ?? null,
    grossWeightG: null,
    dimensionsCm: null,
    fragile: false,
    temperature: 'ambient',
    searchKeywords: buildSearchKeywords(seed.name, seed.description),
  };
  return { ...entry, id: seed.id };
}

const opt = (id: string, name: string, priceDeltaCents = 0, available = true) => ({
  id,
  name,
  priceDeltaCents,
  available,
});

const burgerPoint: OptionGroup = {
  id: 'ponto',
  name: 'Ponto da carne',
  min: 1,
  max: 1,
  options: [opt('mal', 'Mal passado'), opt('ao-ponto', 'Ao ponto'), opt('bem', 'Bem passado')],
};
const burgerExtras: OptionGroup = {
  id: 'extras',
  name: 'Adicionais',
  min: 0,
  max: 4,
  options: [
    opt('bacon', 'Bacon', 400),
    opt('cheddar', 'Cheddar extra', 300),
    opt('ovo', 'Ovo', 250),
    opt('cebola', 'Cebola caramelizada', 300),
    opt('picles', 'Picles', 200, false),
  ],
};
const drinkSize: OptionGroup = {
  id: 'tamanho',
  name: 'Tamanho',
  min: 1,
  max: 1,
  options: [opt('lata', 'Lata 350 ml'), opt('600', 'Garrafa 600 ml', 300)],
};
const acaiSize: OptionGroup = {
  id: 'tamanho',
  name: 'Tamanho',
  min: 1,
  max: 1,
  options: [opt('300', '300 ml'), opt('500', '500 ml', 600), opt('700', '700 ml', 1100)],
};
const acaiToppings: OptionGroup = {
  id: 'complementos',
  name: 'Complementos (até 4)',
  min: 0,
  max: 4,
  options: [
    opt('granola', 'Granola'),
    opt('banana', 'Banana'),
    opt('morango', 'Morango', 200),
    opt('leite-po', 'Leite em pó'),
    opt('pacoca', 'Paçoca', 150),
    opt('nutella', 'Creme de avelã', 400),
  ],
};
const pizzaSize: OptionGroup = {
  id: 'tamanho',
  name: 'Tamanho',
  min: 1,
  max: 1,
  options: [opt('media', 'Média (6 fatias)'), opt('grande', 'Grande (8 fatias)', 1200)],
};
const pizzaCrust: OptionGroup = {
  id: 'borda',
  name: 'Borda',
  min: 0,
  max: 1,
  options: [opt('catupiry', 'Catupiry', 900), opt('cheddar', 'Cheddar', 900)],
};

interface StoreSeed {
  store: Storefront;
  categories: CategoryEntry[];
  items: CatalogEntry[];
}

const radius = (tiers: Array<[number, number, number]>) => ({
  mode: 'radius' as const,
  radiusTiers: tiers.map(([upToKm, feeCents, etaMinutes]) => ({ upToKm, feeCents, etaMinutes })),
  districts: [],
});

export function demoStores(): StoreSeed[] {
  return [
    {
      store: {
        slug: 'burger-da-vila',
        tenantId: 'demo-burger',
        tradeName: 'Burger da Vila',
        segment: 'restaurant',
        logoPath: 'emoji:🍔',
        open: true,
        phone: '11987654321',
        address: {
          cep: '05433000',
          street: 'Rua Fradique Coutinho',
          number: '320',
          complement: null,
          district: 'Pinheiros',
          city: 'São Paulo',
          state: 'SP',
          location: { lat: -23.5617, lng: -46.6883 },
        },
        openingHours: allDay,
        prepTimeMinutes: 20,
        delivery: {
          ...radius([
            [3, 590, 20],
            [6, 890, 30],
            [10, 1290, 45],
          ]),
          minOrderCents: 2500,
          freeShippingAboveCents: 12000,
          pickupEnabled: true,
        },
      },
      categories: [
        { id: 'burgers', name: 'Burgers', parentId: null, displayOrder: 0 },
        { id: 'porcoes', name: 'Porções', parentId: null, displayOrder: 1 },
        { id: 'bebidas', name: 'Bebidas', parentId: null, displayOrder: 2 },
        { id: 'sobremesas', name: 'Sobremesas', parentId: null, displayOrder: 3 },
      ],
      items: items([
        {
          id: 'classico',
          name: 'Clássico da Vila',
          description: 'Blend 160 g, queijo prato, alface, tomate e molho da casa no pão brioche.',
          emoji: '🍔',
          price: 3290,
          category: 'burgers',
          groups: [burgerPoint, burgerExtras],
        },
        {
          id: 'bacon-duplo',
          name: 'Bacon Duplo',
          description: 'Dois blends de 120 g, cheddar, muito bacon e maionese defumada.',
          emoji: '🥓',
          price: 4290,
          promo: 3790,
          category: 'burgers',
          groups: [burgerPoint, burgerExtras],
        },
        {
          id: 'smash',
          name: 'Smash Simples',
          description: 'Blend smash 90 g, queijo americano e cebola na chapa.',
          emoji: '🍔',
          price: 2490,
          category: 'burgers',
          groups: [burgerExtras],
        },
        {
          id: 'veggie',
          name: 'Veggie de Grão-de-bico',
          description: 'Hambúrguer de grão-de-bico, rúcula, tomate seco e maionese verde.',
          emoji: '🥗',
          price: 3190,
          category: 'burgers',
          groups: [burgerExtras],
        },
        {
          id: 'fritas',
          name: 'Batata frita',
          description: 'Porção de 300 g com sal e alecrim.',
          emoji: '🍟',
          price: 1890,
          category: 'porcoes',
        },
        {
          id: 'onion',
          name: 'Onion rings',
          description: '12 anéis de cebola empanados com molho barbecue.',
          emoji: '🧅',
          price: 2190,
          category: 'porcoes',
        },
        {
          id: 'nuggets',
          name: 'Nuggets de frango',
          description: '10 unidades com molho mostarda e mel.',
          emoji: '🍗',
          price: 2290,
          category: 'porcoes',
          available: false,
        },
        {
          id: 'refri',
          name: 'Refrigerante',
          emoji: '🥤',
          price: 690,
          category: 'bebidas',
          groups: [drinkSize],
        },
        {
          id: 'suco',
          name: 'Suco natural de laranja',
          description: '400 ml, sem açúcar.',
          emoji: '🍊',
          price: 990,
          category: 'bebidas',
        },
        {
          id: 'cerveja',
          name: 'Cerveja artesanal IPA',
          description: '500 ml. Venda proibida para menores de 18 anos.',
          emoji: '🍺',
          price: 2490,
          category: 'bebidas',
          ageRestricted: true,
          maxPerOrder: 6,
        },
        {
          id: 'brownie',
          name: 'Brownie com sorvete',
          description: 'Brownie de chocolate meio amargo com sorvete de creme.',
          emoji: '🍫',
          price: 1890,
          category: 'sobremesas',
        },
        {
          id: 'milkshake',
          name: 'Milkshake de Ovomaltine',
          description: '500 ml.',
          emoji: '🥛',
          price: 2190,
          category: 'sobremesas',
        },
      ]),
    },
    {
      store: {
        slug: 'mercado-bom-preco',
        tenantId: 'demo-mercado',
        tradeName: 'Mercado Bom Preço',
        segment: 'grocery',
        logoPath: 'emoji:🛒',
        open: true,
        phone: '1132123456',
        address: {
          cep: '05415000',
          street: 'Rua Teodoro Sampaio',
          number: '1500',
          complement: null,
          district: 'Pinheiros',
          city: 'São Paulo',
          state: 'SP',
          location: { lat: -23.5632, lng: -46.6799 },
        },
        openingHours: allDay,
        prepTimeMinutes: 30,
        delivery: {
          ...radius([
            [4, 790, 40],
            [8, 1190, 60],
          ]),
          minOrderCents: 5000,
          freeShippingAboveCents: 20000,
          pickupEnabled: true,
        },
      },
      categories: [
        { id: 'hortifruti', name: 'Hortifrúti', parentId: null, displayOrder: 0 },
        { id: 'mercearia', name: 'Mercearia', parentId: null, displayOrder: 1 },
        { id: 'padaria', name: 'Padaria', parentId: null, displayOrder: 2 },
        { id: 'bebidas', name: 'Bebidas', parentId: null, displayOrder: 3 },
        { id: 'limpeza', name: 'Limpeza', parentId: null, displayOrder: 4 },
      ],
      items: items([
        {
          id: 'banana',
          name: 'Banana prata',
          description: 'Preço por kg; o valor final é ajustado na pesagem.',
          emoji: '🍌',
          price: 699,
          category: 'hortifruti',
          unit: 'kg',
        },
        {
          id: 'tomate',
          name: 'Tomate italiano',
          description: 'Preço por kg.',
          emoji: '🍅',
          price: 899,
          promo: 749,
          category: 'hortifruti',
          unit: 'kg',
        },
        { id: 'alface', name: 'Alface crespa', emoji: '🥬', price: 349, category: 'hortifruti' },
        {
          id: 'abacate',
          name: 'Abacate',
          description: 'Preço por kg.',
          emoji: '🥑',
          price: 1199,
          category: 'hortifruti',
          unit: 'kg',
        },
        {
          id: 'arroz',
          name: 'Arroz agulhinha tipo 1 5 kg',
          emoji: '🍚',
          price: 2790,
          category: 'mercearia',
          maxPerOrder: 5,
        },
        {
          id: 'feijao',
          name: 'Feijão carioca 1 kg',
          emoji: '🫘',
          price: 849,
          category: 'mercearia',
        },
        {
          id: 'cafe',
          name: 'Café torrado e moído 500 g',
          emoji: '☕',
          price: 1899,
          promo: 1590,
          category: 'mercearia',
        },
        {
          id: 'azeite',
          name: 'Azeite extravirgem 500 ml',
          emoji: '🫒',
          price: 3490,
          category: 'mercearia',
        },
        {
          id: 'pao-frances',
          name: 'Pão francês',
          description: 'Preço por kg.',
          emoji: '🥖',
          price: 1690,
          category: 'padaria',
          unit: 'kg',
        },
        {
          id: 'leite',
          name: 'Leite integral 1 l',
          emoji: '🥛',
          price: 549,
          category: 'bebidas',
          maxPerOrder: 12,
        },
        { id: 'agua', name: 'Água mineral 1,5 l', emoji: '💧', price: 299, category: 'bebidas' },
        {
          id: 'detergente',
          name: 'Detergente neutro 500 ml',
          emoji: '🧴',
          price: 279,
          category: 'limpeza',
        },
        {
          id: 'papel',
          name: 'Papel higiênico folha dupla 12 rolos',
          emoji: '🧻',
          price: 2290,
          category: 'limpeza',
        },
      ]),
    },
    {
      store: {
        slug: 'acai-da-praca',
        tenantId: 'demo-acai',
        tradeName: 'Açaí da Praça',
        segment: 'bakery',
        logoPath: 'emoji:🍇',
        open: true,
        phone: '11955554444',
        address: {
          cep: '05435000',
          street: 'Praça Benedito Calixto',
          number: '50',
          complement: null,
          district: 'Pinheiros',
          city: 'São Paulo',
          state: 'SP',
          location: { lat: -23.5579, lng: -46.6812 },
        },
        openingHours: allDay,
        prepTimeMinutes: 10,
        delivery: {
          ...radius([
            [2, 390, 15],
            [5, 690, 25],
          ]),
          minOrderCents: 1500,
          freeShippingAboveCents: null,
          pickupEnabled: false,
        },
      },
      categories: [
        { id: 'acai', name: 'Açaí', parentId: null, displayOrder: 0 },
        { id: 'cremes', name: 'Cremes', parentId: null, displayOrder: 1 },
      ],
      items: items([
        {
          id: 'acai-tradicional',
          name: 'Açaí tradicional',
          description: 'Açaí puro batido na hora.',
          emoji: '🍇',
          price: 1490,
          category: 'acai',
          groups: [acaiSize, acaiToppings],
        },
        {
          id: 'acai-banana',
          name: 'Açaí com banana',
          description: 'Açaí batido com banana.',
          emoji: '🍌',
          price: 1590,
          category: 'acai',
          groups: [acaiSize, acaiToppings],
        },
        {
          id: 'cupuacu',
          name: 'Creme de cupuaçu',
          emoji: '🥥',
          price: 1690,
          category: 'cremes',
          groups: [acaiSize, acaiToppings],
        },
      ]),
    },
    {
      store: {
        slug: 'pizzaria-napoli',
        tenantId: 'demo-pizza',
        tradeName: 'Pizzaria Napoli',
        segment: 'restaurant',
        logoPath: 'emoji:🍕',
        open: true,
        phone: '1130304040',
        address: {
          cep: '05417000',
          street: 'Rua dos Pinheiros',
          number: '800',
          complement: null,
          district: 'Pinheiros',
          city: 'São Paulo',
          state: 'SP',
          location: { lat: -23.5672, lng: -46.6869 },
        },
        openingHours: closedNow(),
        prepTimeMinutes: 35,
        delivery: {
          ...radius([[6, 800, 40]]),
          minOrderCents: 4000,
          freeShippingAboveCents: null,
          pickupEnabled: true,
        },
      },
      categories: [{ id: 'pizzas', name: 'Pizzas', parentId: null, displayOrder: 0 }],
      items: items([
        {
          id: 'margherita',
          name: 'Margherita',
          description: 'Molho de tomate, muçarela de búfala e manjericão.',
          emoji: '🍕',
          price: 5490,
          category: 'pizzas',
          groups: [pizzaSize, pizzaCrust],
        },
        {
          id: 'calabresa',
          name: 'Calabresa',
          description: 'Calabresa fatiada, cebola e azeitonas.',
          emoji: '🍕',
          price: 4990,
          category: 'pizzas',
          groups: [pizzaSize, pizzaCrust],
        },
      ]),
    },
  ];
}

/** Endereço salvo do usuário de demonstração, perto das lojas. */
export const demoAddress: Omit<AddressEntry, 'id'> = {
  label: 'Casa',
  cep: '05445000',
  street: 'Rua Girassol',
  number: '820',
  complement: 'Apto 52',
  district: 'Vila Madalena',
  city: 'São Paulo',
  state: 'SP',
  location: { lat: -23.5521, lng: -46.6915 },
  reference: 'Portaria 24 horas',
};
