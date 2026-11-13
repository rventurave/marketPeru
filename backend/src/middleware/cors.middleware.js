// CORS restringido a los dominios autorizados (env.ALLOWED_ORIGINS).
// CORS no sustituye a la autenticación; solo controla el acceso entre orígenes.

function getAllowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowed(origin, allowed) {
  return allowed.includes(origin);
}

export function applyCors(response, request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return response;

  const allowed = getAllowedOrigins(env);
  if (!isAllowed(origin, allowed)) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function handlePreflight(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = getAllowedOrigins(env);

  const headers = new Headers();
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  headers.set('Access-Control-Max-Age', '86400');

  if (origin && isAllowed(origin, allowed)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }

  return new Response(null, { status: 204, headers });
}
