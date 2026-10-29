/**
 * Perfis e permissões.
 *
 * A empresa (tid) e o perfil (role) do usuário vão como custom claims no token,
 * gravados apenas por Cloud Functions. As Security Rules (firebase/firestore.rules)
 * repetem estes conjuntos; os testes de regras garantem que os dois lados batem.
 */

/** Perfis de quem trabalha num comércio (uma empresa = um tenant). */
export const TENANT_ROLES = ['owner', 'manager', 'finance', 'hr', 'attendant', 'picker'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  owner: 'Dono',
  manager: 'Gerente',
  finance: 'Financeiro',
  hr: 'RH',
  attendant: 'Atendente',
  picker: 'Separador',
};

/** Perfis da equipe interna do Hiper Delivery (painel administrativo). */
export const PLATFORM_ROLES = ['admin', 'support', 'ops', 'finance'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** Custom claims gravados no token do Firebase Auth. */
export interface HiperClaims {
  /** Empresa do usuário. Ausente para clientes finais e entregadores. */
  tid?: string;
  /** Perfil dentro da empresa `tid`. */
  role?: TenantRole;
  /** Entregador verificado da rede aberta. */
  courier?: boolean;
  /** Perfil da equipe interna do Hiper Delivery. */
  staff?: PlatformRole;
}

/** Quem cadastra e edita produtos e categorias. */
export const CATALOG_EDITORS: readonly TenantRole[] = ['owner', 'manager'];
/** Quem pode pausar e reativar um produto (ex.: item acabou no meio do turno). */
export const PRODUCT_PAUSERS: readonly TenantRole[] = ['owner', 'manager', 'attendant'];
/** Quem lê e edita custo de compra, fornecedores e margem. */
export const COST_ACCESS: readonly TenantRole[] = ['owner', 'manager', 'finance'];
/** Quem gerencia a equipe da empresa. */
export const MEMBER_MANAGERS: readonly TenantRole[] = ['owner', 'manager'];
/** Quem edita os dados operacionais da empresa (nome fantasia, contato, endereço, horários). */
export const TENANT_PROFILE_EDITORS: readonly TenantRole[] = ['owner', 'manager'];
/** Quem edita os dados legais e fiscais da empresa (razão social, CNPJ, regime). */
export const TENANT_LEGAL_EDITORS: readonly TenantRole[] = ['owner'];

export function hasRole(role: TenantRole | undefined, allowed: readonly TenantRole[]): boolean {
  return role !== undefined && allowed.includes(role);
}

/**
 * Quais perfis cada gerenciador pode atribuir. O gerente não cria outro gerente
 * nem dono; só o dono mexe em donos e gerentes.
 */
export function assignableRoles(actor: TenantRole): readonly TenantRole[] {
  switch (actor) {
    case 'owner':
      return TENANT_ROLES;
    case 'manager':
      return ['finance', 'hr', 'attendant', 'picker'];
    default:
      return [];
  }
}

export function isTenantRole(value: unknown): value is TenantRole {
  return typeof value === 'string' && (TENANT_ROLES as readonly string[]).includes(value);
}
