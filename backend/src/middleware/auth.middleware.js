// Middleware de autenticación basado en cookies de sesión.
//
// requireAuth(handler) autentica la petición, adjunta la identidad al contexto
// (ctx.auth) y solo entonces invoca el handler. La identidad se deriva siempre
// de la sesión, nunca de un id enviado por el cliente.

import { unauthorized, forbidden } from '../utils/errors.js';
import { getSessionToken } from '../utils/cookies.js';
import { hashSessionToken } from '../utils/token.js';
import { createSessionsRepository } from '../repositories/sessions.repository.js';

export function requireAuth(handler) {
  return async (ctx) => {
    const token = getSessionToken(ctx.request);
    if (!token) throw unauthorized();

    const tokenHash = await hashSessionToken(token);
    const session = await createSessionsRepository(ctx.env.DB).findByTokenHash(tokenHash);
    if (!session) throw unauthorized();

    if (session.expires_at <= new Date().toISOString()) {
      throw unauthorized('SESSION_EXPIRED', 'La sesión ha expirado');
    }

    if (session.user_status !== 'active') {
      throw forbidden('ACCOUNT_SUSPENDED', 'La cuenta no está activa');
    }

    ctx.auth = {
      userId: session.user_id,
      sessionId: session.session_id,
      csrfToken: session.csrf_token,
      user: {
        id: session.user_id,
        email: session.email,
        name: session.name,
        role: session.role,
        status: session.user_status,
      },
    };

    return handler(ctx);
  };
}
