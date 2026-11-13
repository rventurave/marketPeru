// Rutas del usuario autenticado.

import { updateMe } from '../controllers/users.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireCsrf } from '../middleware/csrf.middleware.js';

export function registerUsersRoutes(router) {
  router.patch('/api/users/me', requireAuth(requireCsrf(updateMe)));
}
