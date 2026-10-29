import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { paths, productInputSchema, productSearchKeywords, toCatalogItem } from '@hiper/shared';
import { db } from './admin';

/**
 * Gera a vitrine pública (tenants/{id}/catalog) a partir da ficha do produto.
 * O cliente final só lê o catálogo, nunca a ficha, que tem código interno,
 * dados fiscais e estoque. As palavras-chave são recalculadas aqui para não
 * depender do que o painel enviou.
 */
export const syncCatalog = onDocumentWritten(
  'tenants/{tenantId}/products/{productId}',
  async (event) => {
    const { tenantId, productId } = event.params;
    const catalogRef = db.doc(paths.catalogItem(tenantId, productId));
    const data = event.data?.after.data();
    if (!data) {
      // Produto excluído: some da loja e o custo vai junto.
      await Promise.all([
        catalogRef.delete(),
        db.doc(paths.productCost(tenantId, productId)).delete(),
      ]);
      return;
    }

    const parsed = productInputSchema.safeParse(data);
    if (!parsed.success) {
      logger.warn('Produto fora do formato; removido da loja', {
        tenantId,
        productId,
        issues: parsed.error.issues.slice(0, 5),
      });
      await catalogRef.delete();
      return;
    }

    const item = toCatalogItem({
      ...parsed.data,
      searchKeywords: productSearchKeywords(parsed.data),
    });
    if (!item) {
      await catalogRef.delete();
      return;
    }
    await catalogRef.set({ ...item, updatedAt: FieldValue.serverTimestamp() });
  },
);
