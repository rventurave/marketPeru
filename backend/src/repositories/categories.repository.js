// Acceso a datos de categorías.

export function createCategoriesRepository(db) {
  return {
    async listAll() {
      const result = await db
        .prepare('SELECT id, name, slug, parent_id FROM categories ORDER BY name ASC')
        .all();
      return result.results;
    },

    async findById(id) {
      return await db
        .prepare('SELECT id, name, slug, parent_id FROM categories WHERE id = ?')
        .bind(id)
        .first();
    },
  };
}
