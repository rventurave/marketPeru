// Rate limiting simple en memoria (ventana fija por IP).
//
// Nota: el estado en memoria es por-isolate y no se comparte entre réplicas.
// Para producción se recomienda Cloudflare Rate Limiting (WAF) o un almacén
// durable (KV/D1). Esta implementación cubre el caso local.

import { fail } from '../utils/response.js';

const buckets = new Map();

function check(key, max, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

export function rateLimit(request, env) {
  const max = Number(env.RATE_LIMIT_MAX) || 1000;
  const windowMs = Number(env.RATE_LIMIT_WINDOW_MS) || 60_000;
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (check(`global:${ip}`, max, windowMs)) {
    return fail('RATE_LIMITED', 'Demasiadas solicitudes', 429);
  }
  return null;
}

export function rateLimitAuth(request, env) {
  const max = Number(env.AUTH_RATE_LIMIT_MAX) || 10;
  const windowMs = Number(env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (check(`auth:${ip}`, max, windowMs)) {
    return fail('RATE_LIMITED', 'Demasiados intentos. Intenta más tarde', 429);
  }
  return null;
}
