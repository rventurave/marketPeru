// Rutas de opiniones: lectura pública + creación privada (requiere auth).

import { getReview } from '../controllers/reviews.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { notImplemented } from '../utils/errors.js';

export function registerReviewsRoutes(router) {
  router.get('/api/reviews/:id', getReview);

  // Privada: se implementa en una etapa posterior.
  router.post('/api/reviews', requireAuth(() => {
    throw notImplemented();
  }));
}
