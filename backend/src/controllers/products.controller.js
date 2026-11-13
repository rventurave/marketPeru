// Controladores HTTP de productos.

import { createProductsService } from '../services/products.service.js';
import { parseIdParam, parseProductListQuery } from '../validators/query.validator.js';
import { ok } from '../utils/response.js';

export async function listProducts(ctx) {
  const service = createProductsService(ctx.env);
  const options = parseProductListQuery(ctx.query);
  const result = await service.listProducts(options);
  return ok(result.items, result.meta);
}

export async function getProduct(ctx) {
  const service = createProductsService(ctx.env);
  const id = parseIdParam(ctx.params);
  const product = await service.getProduct(id);
  return ok(product);
}
