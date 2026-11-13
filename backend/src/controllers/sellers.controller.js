// Controladores HTTP de vendedores.

import { createSellersService } from '../services/sellers.service.js';
import { parseIdParam, parseListQuery } from '../validators/query.validator.js';
import { parsePagination } from '../utils/pagination.js';
import { ok } from '../utils/response.js';

export async function getSeller(ctx) {
  const service = createSellersService(ctx.env);
  const id = parseIdParam(ctx.params);
  const { page, limit, offset, sort } = parseListQuery(ctx.query);
  const seller = await service.getSeller(id, { page, limit, offset, sort });
  return ok(seller);
}

export async function listSellerReviews(ctx) {
  const service = createSellersService(ctx.env);
  const id = parseIdParam(ctx.params);
  const { page, limit, offset } = parsePagination(ctx.query);
  const result = await service.listSellerReviews(id, { page, limit, offset });
  return ok(result.items, result.meta);
}
