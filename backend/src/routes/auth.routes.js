// Rutas de autenticación y usuario autenticado.

import { register, login, logout, me } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerAuthRoutes(router) {
  router.post('/api/auth/register', register);
  router.post('/api/auth/login', login);
  router.post('/api/auth/logout', logout);
  router.get('/api/auth/me', requireAuth(me));
}
