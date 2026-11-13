import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { hashSessionToken } from '../src/utils/token.js';
import { rateLimitAuth } from '../src/middleware/rate-limit.middleware.js';

let emailCounter = 0;
function uniqueEmail() {
  emailCounter += 1;
  return `user${emailCounter}-${Date.now()}@test.com`;
}

function parseSessionCookie(res) {
  const header = res.headers.get('Set-Cookie');
  if (!header) return null;
  const m = header.match(/mp_session=([^;]+)/);
  return m ? m[1] : null;
}

async function registerUser({ name = 'Usuario Test', email = uniqueEmail(), password = 'password123', extra = {} } = {}) {
  const res = await SELF.fetch('https://marketperu.test/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, ...extra }),
  });
  const json = await res.json();
  return { res, json, cookie: parseSessionCookie(res), csrfToken: json.data?.csrf_token, email, password };
}

async function loginUser(email, password, { returnTo } = {}) {
  const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  const res = await SELF.fetch(`https://marketperu.test/api/auth/login${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  return { res, json, cookie: parseSessionCookie(res), csrfToken: json.data?.csrf_token };
}

async function createSellerProfile(userId) {
  await env.DB.prepare('INSERT INTO seller_profiles (user_id, display_name) VALUES (?, ?)')
    .bind(userId, 'Perfil Vendedor')
    .run();
}

// --- Registro -----------------------------------------------------------------

describe('POST /api/auth/register', () => {
  it('registra un usuario y crea sesión', async () => {
    const { res, json, cookie } = await registerUser();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.id).toBeTruthy();
    expect(json.data.email).toMatch(/@test\.com$/);
    expect(json.data.csrf_token).toBeTruthy();
    expect(cookie).toBeTruthy();

    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=');
    expect(json.data).not.toHaveProperty('password_hash');
    expect(json.data).not.toHaveProperty('role');
  });

  it('rechaza correo duplicado', async () => {
    const first = await registerUser();
    expect(first.res.status).toBe(201);

    const dup = await registerUser({ email: first.email });
    expect(dup.res.status).toBe(409);
    expect(dup.json.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rechaza correo inválido', async () => {
    const { res, json } = await registerUser({ email: 'no-es-correo' });
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('INVALID_EMAIL');
  });

  it('rechaza contraseña débil', async () => {
    const { res, json } = await registerUser({ password: 'corta' });
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('WEAK_PASSWORD');
  });

  it('rechaza campos obligatorios ausentes', async () => {
    const res = await SELF.fetch('https://marketperu.test/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail() }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('NAME_REQUIRED');
  });

  it('rechaza contraseña y confirmación distintas', async () => {
    const { res, json } = await registerUser({ extra: { confirmPassword: 'diferente123' } });
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('PASSWORD_MISMATCH');
  });

  it('no permite auto-asignarse rol de administrador', async () => {
    const { json } = await registerUser({ extra: { role: 'admin' } });
    expect(json.data).not.toHaveProperty('role');

    const row = await env.DB.prepare('SELECT role FROM users WHERE email = ?').bind(json.data.email).first();
    expect(row.role).toBe('user');
  });
});

// --- Login --------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  it('inicia sesión con credenciales correctas', async () => {
    const reg = await registerUser();
    const login = await loginUser(reg.email, reg.password);
    expect(login.res.status).toBe(200);
    expect(login.cookie).toBeTruthy();
    expect(login.json.data.email).toBe(reg.email);
    expect(login.json.data.csrf_token).toBeTruthy();
  });

  it('rechaza contraseña incorrecta con mensaje genérico', async () => {
    const reg = await registerUser();
    const login = await loginUser(reg.email, 'contraseña-mala');
    expect(login.res.status).toBe(401);
    expect(login.json.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rechaza usuario inexistente con el mismo mensaje genérico', async () => {
    const login = await loginUser('noexiste@test.com', 'password123');
    expect(login.res.status).toBe(401);
    expect(login.json.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rechaza usuario suspendido', async () => {
    const reg = await registerUser();
    await env.DB.prepare("UPDATE users SET status = 'suspended' WHERE email = ?").bind(reg.email).run();
    const login = await loginUser(reg.email, reg.password);
    expect(login.res.status).toBe(401);
    expect(login.json.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rechaza Content-Type incorrecto', async () => {
    const res = await SELF.fetch('https://marketperu.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'email=x&password=y',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_CONTENT_TYPE');
  });
});

// --- Sesiones -----------------------------------------------------------------

describe('sesiones', () => {
  it('consulta /auth/me con sesión válida', async () => {
    const reg = await registerUser();
    const res = await SELF.fetch('https://marketperu.test/api/auth/me', {
      headers: { Cookie: `mp_session=${reg.cookie}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(reg.json.data.id);
    expect(body.data.email).toBe(reg.email);
  });

  it('devuelve 401 sin cookie', async () => {
    const res = await SELF.fetch('https://marketperu.test/api/auth/me');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('AUTH_REQUIRED');
  });

  it('devuelve 401 con token inválido', async () => {
    const res = await SELF.fetch('https://marketperu.test/api/auth/me', {
      headers: { Cookie: 'mp_session=token-invalido' },
    });
    expect(res.status).toBe(401);
  });

  it('devuelve 401 con sesión expirada', async () => {
    const reg = await registerUser();
    const token = 'expired-token';
    const tokenHash = await hashSessionToken(token);
    await env.DB.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), reg.json.data.id, tokenHash, 'csrf', new Date(Date.now() - 1000).toISOString(), new Date().toISOString())
      .run();

    const res = await SELF.fetch('https://marketperu.test/api/auth/me', {
      headers: { Cookie: `mp_session=${token}` },
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('SESSION_EXPIRED');
  });

  it('devuelve 401 con sesión revocada', async () => {
    const reg = await registerUser();
    const tokenHash = await hashSessionToken(reg.cookie);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();

    const res = await SELF.fetch('https://marketperu.test/api/auth/me', {
      headers: { Cookie: `mp_session=${reg.cookie}` },
    });
    expect(res.status).toBe(401);
  });

  it('mantiene la sesión en solicitudes posteriores', async () => {
    const reg = await registerUser();
    for (let i = 0; i < 3; i++) {
      const res = await SELF.fetch('https://marketperu.test/api/auth/me', {
        headers: { Cookie: `mp_session=${reg.cookie}` },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).data.id).toBe(reg.json.data.id);
    }
  });

  it('cierra sesión correctamente', async () => {
    const reg = await registerUser();
    const logoutRes = await SELF.fetch('https://marketperu.test/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: `mp_session=${reg.cookie}` },
    });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers.get('Set-Cookie')).toContain('Max-Age=0');

    const meRes = await SELF.fetch('https://marketperu.test/api/auth/me', {
      headers: { Cookie: `mp_session=${reg.cookie}` },
    });
    expect(meRes.status).toBe(401);
  });

  it('cierra sesión incluso sin sesión válida', async () => {
    const res = await SELF.fetch('https://marketperu.test/api/auth/logout', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});

// --- Perfil -------------------------------------------------------------------

describe('GET /api/auth/me y PATCH /api/users/me', () => {
  it('devuelve el perfil propio sin datos privados', async () => {
    const reg = await registerUser();
    const res = await SELF.fetch('https://marketperu.test/api/auth/me', {
      headers: { Cookie: `mp_session=${reg.cookie}` },
    });
    const body = await res.json();
    expect(body.data.email).toBe(reg.email);
    expect(body.data.status).toBe('active');
    expect(body.data.created_at).toBeTruthy();
    const json = JSON.stringify(body.data);
    expect(json).not.toContain('password_hash');
    expect(json).not.toContain('token_hash');
  });

  it('actualiza el nombre', async () => {
    const reg = await registerUser();
    const res = await SELF.fetch('https://marketperu.test/api/users/me', {
      method: 'PATCH',
      headers: {
        Cookie: `mp_session=${reg.cookie}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': reg.csrfToken,
      },
      body: JSON.stringify({ name: 'Nuevo Nombre' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.name).toBe('Nuevo Nombre');
  });

  it('actualiza descripción y ubicación con perfil de vendedor', async () => {
    const reg = await registerUser();
    await createSellerProfile(reg.json.data.id);

    const res = await SELF.fetch('https://marketperu.test/api/users/me', {
      method: 'PATCH',
      headers: {
        Cookie: `mp_session=${reg.cookie}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': reg.csrfToken,
      },
      body: JSON.stringify({ bio: 'Vendo cosas', location: 'Cusco' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.seller_profile.bio).toBe('Vendo cosas');
    expect(body.data.seller_profile.location).toBe('Cusco');
  });

  it('no permite modificar el rol ni la reputación', async () => {
    const reg = await registerUser();
    await createSellerProfile(reg.json.data.id);

    const res = await SELF.fetch('https://marketperu.test/api/users/me', {
      method: 'PATCH',
      headers: {
        Cookie: `mp_session=${reg.cookie}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': reg.csrfToken,
      },
      body: JSON.stringify({ role: 'admin', average_rating: 5 }),
    });
    expect(res.status).toBe(200);

    const row = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(reg.json.data.id).first();
    expect(row.role).toBe('user');
  });
});

// --- Middleware ---------------------------------------------------------------

describe('middleware de autenticación', () => {
  it('rutas públicas accesibles sin cuenta', async () => {
    const res = await SELF.fetch('https://marketperu.test/api/products');
    expect(res.status).toBe(200);
  });

  it('ruta privada devuelve 501 con sesión válida (aún no implementada)', async () => {
    const reg = await registerUser();
    const res = await SELF.fetch('https://marketperu.test/api/products', {
      method: 'POST',
      headers: { Cookie: `mp_session=${reg.cookie}` },
    });
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('NOT_IMPLEMENTED');
  });

  it('identidad derivada de la sesión, no del cuerpo', async () => {
    const reg = await registerUser();
    const res = await SELF.fetch('https://marketperu.test/api/auth/me', {
      headers: { Cookie: `mp_session=${reg.cookie}` },
    });
    const body = await res.json();
    expect(body.data.id).toBe(reg.json.data.id);
  });
});

// --- Seguridad ----------------------------------------------------------------

describe('CSRF', () => {
  it('rechaza PATCH sin token CSRF', async () => {
    const reg = await registerUser();
    const res = await SELF.fetch('https://marketperu.test/api/users/me', {
      method: 'PATCH',
      headers: { Cookie: `mp_session=${reg.cookie}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('rechaza PATCH con token CSRF incorrecto', async () => {
    const reg = await registerUser();
    const res = await SELF.fetch('https://marketperu.test/api/users/me', {
      method: 'PATCH',
      headers: {
        Cookie: `mp_session=${reg.cookie}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'token-incorrecto',
      },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(403);
  });

  it('acepta PATCH con token CSRF correcto', async () => {
    const reg = await registerUser();
    const res = await SELF.fetch('https://marketperu.test/api/users/me', {
      method: 'PATCH',
      headers: {
        Cookie: `mp_session=${reg.cookie}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': reg.csrfToken,
      },
      body: JSON.stringify({ name: 'Nombre Correcto' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('CORS y origen', () => {
  it('preflight con origen permitido', async () => {
    const res = await SELF.fetch('https://marketperu.test/api/auth/login', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8787' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8787');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('rechaza origen no permitido en operación de estado', async () => {
    const res = await SELF.fetch('https://marketperu.test/api/auth/login', {
      method: 'POST',
      headers: { Origin: 'https://evil.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'password123' }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('CSRF_ORIGIN_INVALID');
  });
});

describe('open redirect (returnTo)', () => {
  it('acepta ruta interna', async () => {
    const reg = await registerUser();
    const login = await loginUser(reg.email, reg.password, { returnTo: '/product/123' });
    expect(login.json.data.return_to).toBe('/product/123');
  });

  it('rechaza URL externa', async () => {
    const reg = await registerUser();
    const login = await loginUser(reg.email, reg.password, { returnTo: 'https://evil.com' });
    expect(login.json.data.return_to).toBeNull();
  });

  it('rechaza URL protocol-relative', async () => {
    const reg = await registerUser();
    const login = await loginUser(reg.email, reg.password, { returnTo: '//evil.com' });
    expect(login.json.data.return_to).toBeNull();
  });
});

describe('rate limiting', () => {
  it('bloquea tras superar el límite de auth', () => {
    const fakeEnv = { AUTH_RATE_LIMIT_MAX: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' };
    const makeReq = () =>
      new Request('https://marketperu.test/api/auth/login', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '10.0.0.99' },
      });

    expect(rateLimitAuth(makeReq(), fakeEnv)).toBeNull();
    expect(rateLimitAuth(makeReq(), fakeEnv)).toBeNull();
    expect(rateLimitAuth(makeReq(), fakeEnv)).toBeNull();
    const blocked = rateLimitAuth(makeReq(), fakeEnv);
    expect(blocked.status).toBe(429);
  });
});
