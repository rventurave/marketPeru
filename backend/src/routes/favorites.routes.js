// Rutas de favoritos (privadas): requieren autenticación.

import { requireAuth } from '../middleware/auth.middleware.js';
import { notImplemented } from '../utils/errors.js';

const deferred = () => {
  throw notImplemented();
};

export function registerFavoritesRoutes(router) {
  router.get('/api/favorites', requireAuth(deferred));
  router.post('/api/favorites', requireAuth(deferred));
  router.delete('/api/favorites/:productId', requireAuth(deferred));
}
