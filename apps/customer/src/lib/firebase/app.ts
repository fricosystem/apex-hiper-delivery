import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { env } from '@/lib/env';
import { authPersistence } from './persistence';

interface FirebaseClients {
  auth: Auth;
  db: Firestore;
  functions: Functions;
}

let clients: FirebaseClients | null = null;

/** Inicializa o Firebase uma vez, só quando a fonte de dados é o Firebase. */
export function firebase(): FirebaseClients {
  if (clients) return clients;
  const fresh = getApps().length === 0;
  const app = fresh ? initializeApp(env.firebase) : getApp();
  const auth = fresh ? initializeAuth(app, { persistence: authPersistence() }) : getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, env.functionsRegion);
  if (fresh && env.useEmulators) {
    const host = env.emulatorHost;
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectFunctionsEmulator(functions, host, 5001);
  }
  clients = { auth, db, functions };
  return clients;
}
