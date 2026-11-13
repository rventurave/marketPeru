// Acceso a datos públicos de vendedores.

export function createSellersRepository(db) {
  return {
    async findById(id) {
      const sql = `
        SELECT u.id, sp.display_name, u.avatar_url, sp.bio, sp.location,
               u.created_at AS joined_at, sp.average_rating, sp.rating_count
        FROM users u
        JOIN seller_profiles sp ON sp.user_id = u.id
        WHERE u.id = ? AND u.status = 'active'
      `;
      return await db.prepare(sql).bind(id).first();
    },
  };
}
