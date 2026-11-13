// Controladores HTTP de categorías.

import { createCategoriesService } from '../services/categories.service.js';
import { parseIdParam, parseListQuery } from '../validators/query.validator.js';
import { ok } from '../utils/response.js';

export async function listCategories(ctx) {
  const service = createCategoriesService(ctx.env);
  const items = await service.listCategories();
  return ok(items);
}

export async function listCategoryProducts(ctx) {
  const service = createCategoriesService(ctx.env);
  const id = parseIdParam(ctx.params);
  const { page, limit, offset, sort } = parseListQuery(ctx.query);
  const result = await service.listCategoryProducts(id, { page, limit, offset, sort });
  return ok(result.items, result.meta);
}
