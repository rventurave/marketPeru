// Protección CSRF para operaciones que cambian estado usando cookies de sesión.
//
// Además del token CSRF, se valida el origen para peticiones con cabecera Origin.

import { forbidden } from '../utils/errors.js';
import { timingSafeEqual } from '../utils/crypto.js';

const STATEFUL = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function getAllowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function validateOrigin(request, env) {
  if (!STATEFUL.has(request.method.toUpperCase())) return null;

  const origin = request.headers.get('Origin');
  if (!origin) return null;

  const allowed = getAllowedOrigins(env);
  if (!allowed.includes(origin)) {
    throw forbidden('CSRF_ORIGIN_INVALID', 'Origen no permitido');
  }
  return null;
}

export function requireCsrf(handler) {
  return async (ctx) => {
    if (STATEFUL.has(ctx.request.method.toUpperCase())) {
      const expected = ctx.auth?.csrfToken;
      const provided = ctx.request.headers.get('X-CSRF-Token');
      if (!expected || !provided || !timingSafeEqual(provided, expected)) {
        throw forbidden('CSRF_TOKEN_INVALID', 'Token CSRF inválido');
      }
    }
    return handler(ctx);
  };
}
