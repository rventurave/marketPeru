// Acceso a datos de sesiones.

export function createSessionsRepository(db) {
  return {
    async create({ id, userId, tokenHash, csrfToken, expiresAt, createdAt }) {
      await db
        .prepare(
          'INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(id, userId, tokenHash, csrfToken, expiresAt, createdAt)
        .run();
    },

    async findByTokenHash(tokenHash) {
      const sql = `
        SELECT s.id AS session_id, s.user_id, s.csrf_token, s.expires_at,
               u.email, u.name, u.role, u.status AS user_status, u.created_at AS user_created_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
      `;
      return db.prepare(sql).bind(tokenHash).first();
    },

    async deleteByTokenHash(tokenHash) {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    },

    async deleteExpired(userId, nowIso) {
      await db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').bind(userId, nowIso).run();
    },
  };
}
