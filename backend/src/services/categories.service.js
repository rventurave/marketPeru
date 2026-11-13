// Lógica de negocio de categorías.

import { createCategoriesRepository } from '../repositories/categories.repository.js';
import { createProductsService } from './products.service.js';
import { notFound } from '../utils/errors.js';

function toDto(row) {
  return { id: row.id, name: row.name, slug: row.slug, parent_id: row.parent_id };
}

export function createCategoriesService(env) {
  const repo = createCategoriesRepository(env.DB);
  const productsService = createProductsService(env);

  return {
    async listCategories() {
      const rows = await repo.listAll();
      return rows.map(toDto);
    },

    async listCategoryProducts(id, listOptions) {
      const category = await repo.findById(id);
      if (!category) throw notFound('CATEGORY_NOT_FOUND', 'Categoría no encontrada');
      return productsService.listProducts({ ...listOptions, categoryId: id });
    },
  };
}
