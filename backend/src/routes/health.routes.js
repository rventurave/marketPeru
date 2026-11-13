// Rutas de salud del servicio.

import { ok } from '../utils/response.js';

export function registerHealthRoutes(router) {
  router.get('/api/health', (ctx) => {
    return ok({
      status: 'ok',
      service: 'marketperu-api',
      environment: ctx.env.ENVIRONMENT || 'unknown',
      timestamp: new Date().toISOString(),
    });
  });
}
