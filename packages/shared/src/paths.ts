/**
 * Caminhos do Firestore e do Storage. Tudo de uma empresa fica sob
 * tenants/{tenantId}/..., que é o que as Security Rules usam para isolar
 * uma empresa da outra.
 */

export const paths = {
  tenant: (tenantId: string) => `tenants/${tenantId}`,
  members: (tenantId: string) => `tenants/${tenantId}/members`,
  member: (tenantId: string, uid: string) => `tenants/${tenantId}/members/${uid}`,
  categories: (tenantId: string) => `tenants/${tenantId}/categories`,
  category: (tenantId: string, id: string) => `tenants/${tenantId}/categories/${id}`,
  products: (tenantId: string) => `tenants/${tenantId}/products`,
  product: (tenantId: string, id: string) => `tenants/${tenantId}/products/${id}`,
  /** Custo e fornecedores: documento separado porque as regras valem por documento. */
  productCost: (tenantId: string, productId: string) =>
    `tenants/${tenantId}/productCosts/${productId}`,
  /** Catálogo público da loja, gerado por Function, sem dados internos. */
  catalog: (tenantId: string) => `tenants/${tenantId}/catalog`,
  catalogItem: (tenantId: string, productId: string) => `tenants/${tenantId}/catalog/${productId}`,
  auditLog: (tenantId: string) => `tenants/${tenantId}/auditLog`,
  /** Endereço da loja (loja.hiperdelivery.com.br/{slug}) apontando para a empresa. */
  publicStore: (slug: string) => `publicStores/${slug}`,
  user: (uid: string) => `users/${uid}`,
} as const;

export const storagePaths = {
  /** Fotos de produto: leitura pública, escrita pela equipe da loja. */
  productPhoto: (tenantId: string, productId: string, fileName: string) =>
    `tenants/${tenantId}/public/products/${productId}/${fileName}`,
  tenantLogo: (tenantId: string, fileName: string) => `tenants/${tenantId}/public/logo/${fileName}`,
  /** Arquivos internos (XML de notas, documentos): só perfis autorizados. */
  tenantPrivate: (tenantId: string, fileName: string) => `tenants/${tenantId}/private/${fileName}`,
  userFile: (uid: string, fileName: string) => `users/${uid}/${fileName}`,
} as const;
