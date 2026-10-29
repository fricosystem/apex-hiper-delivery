/**
 * Configuração vinda de EXPO_PUBLIC_* (embutida no build). Veja .env.example.
 * O Expo só substitui process.env.EXPO_PUBLIC_X escrito por extenso.
 */
export const env = {
  dataSource: (process.env.EXPO_PUBLIC_DATA_SOURCE === 'demo' ? 'demo' : 'firebase') as
    'demo' | 'firebase',
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-key',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'demo-hiper-delivery',
    storageBucket:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-hiper-delivery.appspot.com',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  },
  useEmulators: process.env.EXPO_PUBLIC_USE_EMULATORS === '1',
  emulatorHost: process.env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1',
  functionsRegion: 'southamerica-east1',
  mapStyleUrl:
    process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
  osrmUrl: process.env.EXPO_PUBLIC_OSRM_URL || 'https://router.project-osrm.org',
  nominatimUrl: process.env.EXPO_PUBLIC_NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
} as const;
