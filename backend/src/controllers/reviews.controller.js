// Controladores HTTP de opiniones.

import { createReviewsService } from '../services/reviews.service.js';
import { parseIdParam } from '../validators/query.validator.js';
import { ok } from '../utils/response.js';

export async function getReview(ctx) {
  const service = createReviewsService(ctx.env);
  const id = parseIdParam(ctx.params);
  const review = await service.getReview(id);
  return ok(review);
}
