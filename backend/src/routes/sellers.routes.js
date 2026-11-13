// Rutas públicas de vendedores.

import { getSeller, listSellerReviews } from '../controllers/sellers.controller.js';

export function registerSellersRoutes(router) {
  router.get('/api/sellers/:id', getSeller);
  router.get('/api/sellers/:id/reviews', listSellerReviews);
}
