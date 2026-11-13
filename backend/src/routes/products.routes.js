// Rutas de productos: lectura pública + escritura privada (requiere auth).

import { listProducts, getProduct } from '../controllers/products.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { notImplemented } from '../utils/errors.js';

const deferred = () => {
  throw notImplemented();
};

export function registerProductsRoutes(router) {
  router.get('/api/products', listProducts);
  router.get('/api/products/:id', getProduct);

  // Privadas: se implementan en una etapa posterior.
  router.post('/api/products', requireAuth(deferred));
  router.put('/api/products/:id', requireAuth(deferred));
  router.delete('/api/products/:id', requireAuth(deferred));
}
