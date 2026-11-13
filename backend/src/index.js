// Punto de entrada del Worker: enrutador, CORS, rate limiting y manejo de errores.

import { createRouter } from './router.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerProductsRoutes } from './routes/products.routes.js';
import { registerCategoriesRoutes } from './routes/categories.routes.js';
import { registerSellersRoutes } from './routes/sellers.routes.js';
import { registerReviewsRoutes } from './routes/reviews.routes.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerUsersRoutes } from './routes/users.routes.js';
import { registerMessagesRoutes } from './routes/messages.routes.js';
import { registerFavoritesRoutes } from './routes/favorites.routes.js';
import { registerTransactionsRoutes } from './routes/transactions.routes.js';
import { applyCors, handlePreflight } from './middleware/cors.middleware.js';
import { rateLimit, rateLimitAuth } from './middleware/rate-limit.middleware.js';
import { validateOrigin } from './middleware/csrf.middleware.js';
import { handleError } from './middleware/error.middleware.js';
import { json } from './utils/response.js';

const router = createRouter();
registerHealthRoutes(router);
registerProductsRoutes(router);
registerCategoriesRoutes(router);
registerSellersRoutes(router);
registerReviewsRoutes(router);
registerAuthRoutes(router);
registerUsersRoutes(router);
registerMessagesRoutes(router);
registerFavoritesRoutes(router);
registerTransactionsRoutes(router);

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith('/api/')) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } }, 404);
  }

  if (request.method === 'OPTIONS') {
    return handlePreflight(request, env);
  }

  // Validación de origen para operaciones que cambian estado.
  validateOrigin(request, env);

  // Rate limiting: más estricto para auth.
  if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/register') {
    const authLimited = rateLimitAuth(request, env);
    if (authLimited) return authLimited;
  }

  const limited = rateLimit(request, env);
  if (limited) return limited;

  const response = await router.handle(request, ctx, env);
  if (!response) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } }, 404);
  }

  return applyCors(response, request, env);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      return applyCors(handleError(err), request, env);
    }
  },
};
