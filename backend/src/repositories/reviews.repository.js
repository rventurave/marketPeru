// Acceso a datos públicos de opiniones (seller_reviews).

export function createReviewsRepository(db) {
  return {
    async listBySeller(sellerId, { limit, offset }) {
      const sql = `
        SELECT r.id, r.rating, r.comment, r.created_at,
               r.reviewer_id, u.name AS reviewer_name
        FROM seller_reviews r
        JOIN users u ON u.id = r.reviewer_id
        WHERE r.reviewee_id = ?
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ? OFFSET ?
      `;
      const result = await db.prepare(sql).bind(sellerId, limit, offset).all();
      return result.results;
    },

    async countBySeller(sellerId) {
      const row = await db
        .prepare('SELECT COUNT(*) AS total FROM seller_reviews WHERE reviewee_id = ?')
        .bind(sellerId)
        .first();
      return row ? Number(row.total) : 0;
    },

    async findById(id) {
      const sql = `
        SELECT r.id, r.rating, r.comment, r.created_at,
               r.reviewer_id, u.name AS reviewer_name
        FROM seller_reviews r
        JOIN users u ON u.id = r.reviewer_id
        WHERE r.id = ?
      `;
      return await db.prepare(sql).bind(id).first();
    },
  };
}
