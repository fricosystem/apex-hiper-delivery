import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { paths } from '@hiper/shared';
import { db } from './admin';

export interface AuditEntry {
  action: string;
  actorUid: string;
  targetUid?: string;
  data?: Record<string, unknown>;
}

/** Registro imutável de quem fez o quê; lido só pelo dono. */
export function writeAudit(tx: Transaction, tenantId: string, entry: AuditEntry): void {
  const ref = db.collection(paths.auditLog(tenantId)).doc();
  tx.create(ref, { ...entry, at: FieldValue.serverTimestamp() });
}
