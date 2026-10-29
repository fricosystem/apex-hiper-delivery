import { setGlobalOptions } from 'firebase-functions/v2';

// Importado antes de qualquer Function ser definida. Firestore e Functions na
// região de São Paulo, perto dos usuários.
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });
