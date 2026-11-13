// Lógica de negocio de productos y mapeo a DTOs públicos.

import { createProductsRepository } from '../repositories/products.repository.js';
import { buildMeta } from '../utils/pagination.js';
import { notFound } from '../utils/errors.js';

function toListItem(row) {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    currency: row.currency,
    condition: row.condition,
    location: row.location,
    created_at: row.created_at,
    primary_image: row.primary_image ?? null,
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
    seller: {
      id: row.seller_id,
      name: row.seller_name,
      average_rating: row.seller_rating,
      rating_count: row.seller_rating_count,
    },
  };
}

function toDetail(product, images) {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    price: product.price,
    currency: product.currency,
    condition: product.condition,
    location: product.location,
    created_at: product.created_at,
    category: { id: product.category_id, name: product.category_name, slug: product.category_slug },
    images: images.map((img) => ({
      key: img.r2_key,
      position: img.position,
      is_primary: Boolean(img.is_primary),
    })),
    seller: {
      id: product.seller_id,
      name: product.seller_name,
      avatar_url: product.seller_avatar_url,
      location: product.seller_location,
      average_rating: product.seller_rating,
      rating_count: product.seller_rating_count,
      joined_at: product.seller_joined_at,
    },
  };
}

export function createProductsService(env) {
  const repo = createProductsRepository(env.DB);

  return {
    async listProducts({ page, limit, offset, sort, ...filters }) {
      const [rows, total] = await Promise.all([
        repo.list({ ...filters, sort, limit, offset }),
        repo.count(filters),
      ]);
      return {
        items: rows.map(toListItem),
        meta: buildMeta({ page, limit, total }),
      };
    },

    async getProduct(id) {
      const product = await repo.findById(id);
      if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Producto no encontrado');
      const images = await repo.listImages(id);
      return toDetail(product, images);
    },
  };
}
