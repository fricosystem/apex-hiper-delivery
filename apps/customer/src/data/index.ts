import { env } from '@/lib/env';
import { createDemoSource } from './demo-source';
import { createFirebaseSource } from './firebase-source';
import type { DataSource } from './types';

export * from './types';

let source: DataSource | null = null;

/** Fonte de dados do app, escolhida por EXPO_PUBLIC_DATA_SOURCE. */
export function data(): DataSource {
  source ??= env.dataSource === 'demo' ? createDemoSource() : createFirebaseSource();
  return source;
}
