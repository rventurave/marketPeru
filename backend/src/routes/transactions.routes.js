// Rutas de transacciones (privadas): requieren autenticación.
//
// La confirmación bilateral y el manejo de disputas se implementan en la
// siguiente etapa. La autorización del backend ya bloquea estas rutas sin
// sesión válida.

import { requireAuth } from '../middleware/auth.middleware.js';
import { notImplemented } from '../utils/errors.js';

const deferred = () => {
  throw notImplemented();
};

export function registerTransactionsRoutes(router) {
  router.get('/api/transactions', requireAuth(deferred));
  router.get('/api/transactions/:id', requireAuth(deferred));
  router.post('/api/transactions', requireAuth(deferred));
  router.post('/api/transactions/:id/confirm', requireAuth(deferred));
  router.post('/api/transactions/:id/cancel', requireAuth(deferred));
  router.post('/api/transactions/:id/dispute', requireAuth(deferred));
}
