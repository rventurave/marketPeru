// Rutas de mensajería (privadas): requieren autenticación.

import { requireAuth } from '../middleware/auth.middleware.js';
import { notImplemented } from '../utils/errors.js';

const deferred = () => {
  throw notImplemented();
};

export function registerMessagesRoutes(router) {
  router.get('/api/conversations', requireAuth(deferred));
  router.get('/api/conversations/:id/messages', requireAuth(deferred));
  router.post('/api/messages', requireAuth(deferred));
}
