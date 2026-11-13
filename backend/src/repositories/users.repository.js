// Acceso a datos de usuarios y sus perfiles de vendedor.

export function createUsersRepository(db) {
  return {
    async findByEmail(email) {
      return db
        .prepare(
          'SELECT id, email, password_hash, name, role, status, avatar_url, created_at, updated_at FROM users WHERE email = ?',
        )
        .bind(email)
        .first();
    },

    async findById(id) {
      return db
        .prepare('SELECT id, email, name, role, status, avatar_url, created_at, updated_at FROM users WHERE id = ?')
        .bind(id)
        .first();
    },

    async create({ email, passwordHash, name }) {
      await db
        .prepare('INSERT INTO users (email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)')
        .bind(email, passwordHash, name, 'user', 'active')
        .run();
      return db
        .prepare('SELECT id, email, name, role, status, avatar_url, created_at, updated_at FROM users WHERE email = ?')
        .bind(email)
        .first();
    },

    async updateName(id, name) {
      await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, id).run();
    },

    async findSellerProfile(userId) {
      return db
        .prepare(
          'SELECT id, user_id, display_name, bio, location, average_rating, rating_count FROM seller_profiles WHERE user_id = ?',
        )
        .bind(userId)
        .first();
    },

    async updateSellerProfileFields(userId, fields) {
      const sets = [];
      const params = [];
      if (fields.bio !== undefined) {
        sets.push('bio = ?');
        params.push(fields.bio);
      }
      if (fields.location !== undefined) {
        sets.push('location = ?');
        params.push(fields.location);
      }
      if (sets.length === 0) return;
      params.push(userId);
      await db.prepare(`UPDATE seller_profiles SET ${sets.join(', ')} WHERE user_id = ?`).bind(...params).run();
    },
  };
}
