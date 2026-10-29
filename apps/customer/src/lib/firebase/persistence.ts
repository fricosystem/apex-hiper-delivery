import { browserLocalPersistence, type Persistence } from 'firebase/auth';

/** No navegador a sessão fica no armazenamento local. */
export function authPersistence(): Persistence {
  return browserLocalPersistence;
}
