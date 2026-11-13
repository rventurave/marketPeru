// Rutas públicas de categorías.

import { listCategories, listCategoryProducts } from '../controllers/categories.controller.js';

export function registerCategoriesRoutes(router) {
  router.get('/api/categories', listCategories);
  router.get('/api/categories/:id/products', listCategoryProducts);
}
