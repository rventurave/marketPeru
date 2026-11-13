// Acceso a datos de productos (solo catálogo público: status = 'active'
// y vendedor activo). Todas las consultas son parametrizadas.

function escapeLike(term) {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function likePattern(term) {
  return `%${escapeLike(term)}%`;
}

function buildWhere({ sellerId, categoryId, minPrice, maxPrice, location, q }) {
  const where = ["p.status = 'active'", "u.status = 'active'"];
  const params = [];

  if (sellerId != null) {
    where.push('p.seller_id = ?');
    params.push(sellerId);
  }
  if (categoryId != null) {
    where.push('p.category_id = ?');
    params.push(categoryId);
  }
  if (minPrice != null) {
    where.push('p.price >= ?');
    params.push(minPrice);
  }
  if (maxPrice != null) {
    where.push('p.price <= ?');
    params.push(maxPrice);
  }
  if (location) {
    where.push("p.location LIKE ? ESCAPE '\\'");
    params.push(likePattern(location));
  }
  if (q) {
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')");
    params.push(likePattern(q), likePattern(q));
  }

  return { where: where.join(' AND '), params };
}

export function createProductsRepository(db) {
  return {
    async list({ sort = 'p.created_at DESC', limit, offset, ...filters }) {
      const { where, params } = buildWhere(filters);

      const sql = `
        SELECT p.id, p.title, p.price, p.currency, p.condition, p.location, p.created_at,
               c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
               u.id AS seller_id, sp.display_name AS seller_name,
               sp.average_rating AS seller_rating, sp.rating_count AS seller_rating_count,
               (SELECT pi.r2_key FROM product_images pi
                 WHERE pi.product_id = p.id AND pi.is_primary = 1
                 ORDER BY pi.position ASC, pi.id ASC LIMIT 1) AS primary_image
        FROM products p
        JOIN categories c ON c.id = p.category_id
        JOIN users u ON u.id = p.seller_id
        JOIN seller_profiles sp ON sp.user_id = p.seller_id
        WHERE ${where}
        ORDER BY ${sort}
        LIMIT ? OFFSET ?
      `;

      const result = await db.prepare(sql).bind(...params, limit, offset).all();
      return result.results;
    },

    async count(filters) {
      const { where, params } = buildWhere(filters);
      const sql = `
        SELECT COUNT(*) AS total
        FROM products p
        JOIN users u ON u.id = p.seller_id
        WHERE ${where}
      `;
      const row = await db.prepare(sql).bind(...params).first();
      return row ? Number(row.total) : 0;
    },

    async findById(id) {
      const sql = `
        SELECT p.id, p.title, p.description, p.price, p.currency, p.condition, p.location, p.created_at,
               c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
               u.id AS seller_id, sp.display_name AS seller_name, u.avatar_url AS seller_avatar_url,
               sp.location AS seller_location, sp.average_rating AS seller_rating,
               sp.rating_count AS seller_rating_count, u.created_at AS seller_joined_at
        FROM products p
        JOIN categories c ON c.id = p.category_id
        JOIN users u ON u.id = p.seller_id
        JOIN seller_profiles sp ON sp.user_id = p.seller_id
        WHERE p.id = ? AND p.status = 'active' AND u.status = 'active'
      `;
      return await db.prepare(sql).bind(id).first();
    },

    async listImages(productId) {
      const sql =
        'SELECT r2_key, position, is_primary FROM product_images WHERE product_id = ? ORDER BY position ASC, id ASC';
      const result = await db.prepare(sql).bind(productId).all();
      return result.results;
    },
  };
}
