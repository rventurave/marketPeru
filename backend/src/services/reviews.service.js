// Lógica de negocio de opiniones públicas.

import { createReviewsRepository } from '../repositories/reviews.repository.js';
import { notFound } from '../utils/errors.js';

function toReviewDto(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    created_at: row.created_at,
    reviewer: { id: row.reviewer_id, name: row.reviewer_name },
  };
}

export function createReviewsService(env) {
  const repo = createReviewsRepository(env.DB);

  return {
    async getReview(id) {
      const row = await repo.findById(id);
      if (!row) throw notFound('REVIEW_NOT_FOUND', 'Opinión no encontrada');
      return toReviewDto(row);
    },
  };
}
