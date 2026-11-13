// Manejo de cookies de sesión.

export const SESSION_COOKIE = 'mp_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 días

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

export function serializeCookie(name, value, { maxAge, httpOnly = true, secure = false, sameSite = 'Lax', path = '/' }) {
  const parts = [`${name}=${value}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (path) parts.push(`Path=${path}`);
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  return parts.join('; ');
}

export function sessionCookie(token, env) {
  const secure = env.ENVIRONMENT === 'production';
  return serializeCookie(SESSION_COOKIE, token, {
    maxAge: SESSION_TTL_SECONDS,
    secure,
    sameSite: 'Lax',
  });
}

export function clearSessionCookie(env) {
  const secure = env.ENVIRONMENT === 'production';
  return serializeCookie(SESSION_COOKIE, '', {
    maxAge: 0,
    secure,
    sameSite: 'Lax',
  });
}

export function getSessionToken(request) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  return cookies[SESSION_COOKIE] || null;
}
