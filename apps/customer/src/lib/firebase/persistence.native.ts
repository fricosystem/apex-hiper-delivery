import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Persistence } from 'firebase/auth';

// O pacote firebase/auth resolve para o build de React Native no Metro, que
// exporta getReactNativePersistence, mas os tipos publicados são os da web.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

/** No celular a sessão fica no AsyncStorage e sobrevive ao fechar o app. */
export function authPersistence(): Persistence {
  return getReactNativePersistence(AsyncStorage);
}
