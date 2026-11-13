// Controladores HTTP de autenticación.

import { createAuthService } from '../services/auth.service.js';
import { validateRegister, validateLogin } from '../validators/auth.validator.js';
import { readJsonBody, sanitizeReturnTo } from '../utils/http.js';
import { sessionCookie, clearSessionCookie, getSessionToken } from '../utils/cookies.js';
import { hashSessionToken } from '../utils/token.js';
import { ok, created } from '../utils/response.js';

export async function register(ctx) {
  const service = createAuthService(ctx.env);
  const body = await readJsonBody(ctx.request);
  const input = validateRegister(body);
  const { dto, token } = await service.register(input);

  const res = created({ ...dto, return_to: sanitizeReturnTo(ctx.query.get('returnTo')) });
  res.headers.append('Set-Cookie', sessionCookie(token, ctx.env));
  return res;
}

export async function login(ctx) {
  const service = createAuthService(ctx.env);
  const body = await readJsonBody(ctx.request);
  const input = validateLogin(body);
  const { dto, token } = await service.login(input);

  const res = ok({ ...dto, return_to: sanitizeReturnTo(ctx.query.get('returnTo')) });
  res.headers.append('Set-Cookie', sessionCookie(token, ctx.env));
  return res;
}

export async function logout(ctx) {
  const service = createAuthService(ctx.env);
  const token = getSessionToken(ctx.request);
  if (token) {
    const tokenHash = await hashSessionToken(token);
    await service.logout(tokenHash);
  }

  const res = ok({ message: 'Sesión cerrada' });
  res.headers.append('Set-Cookie', clearSessionCookie(ctx.env));
  return res;
}

export async function me(ctx) {
  const service = createAuthService(ctx.env);
  const dto = await service.me(ctx.auth.userId, ctx.auth.csrfToken);
  return ok(dto);
}
