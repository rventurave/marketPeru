// Lógica de negocio de vendedores y sus opiniones públicas.

import { createSellersRepository } from '../repositories/sellers.repository.js';
import { createReviewsRepository } from '../repositories/reviews.repository.js';
import { createProductsService } from './products.service.js';
import { notFound } from '../utils/errors.js';
import { buildMeta } from '../utils/pagination.js';

function toSellerDto(row) {
  return {
    id: row.id,
    name: row.display_name,
    avatar_url: row.avatar_url,
    bio: row.bio,
    location: row.location,
    joined_at: row.joined_at,
    average_rating: row.average_rating,
    rating_count: row.rating_count,
  };
}

function toReviewDto(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    created_at: row.created_at,
    reviewer: { id: row.reviewer_id, name: row.reviewer_name },
  };
}

export function createSellersService(env) {
  const repo = createSellersRepository(env.DB);
  const reviewsRepo = createReviewsRepository(env.DB);
  const productsService = createProductsService(env);

  return {
    async getSeller(id, listOptions) {
      const seller = await repo.findById(id);
      if (!seller) throw notFound('SELLER_NOT_FOUND', 'Vendedor no encontrado');
      const products = await productsService.listProducts({ ...listOptions, sellerId: id });
      return { ...toSellerDto(seller), products };
    },

    async listSellerReviews(id, { page, limit, offset }) {
      const seller = await repo.findById(id);
      if (!seller) throw notFound('SELLER_NOT_FOUND', 'Vendedor no encontrado');

      const [rows, total] = await Promise.all([
        reviewsRepo.listBySeller(id, { limit, offset }),
        reviewsRepo.countBySeller(id),
      ]);

      return {
        items: rows.map(toReviewDto),
        meta: buildMeta({ page, limit, total }),
      };
    },
  };
}
