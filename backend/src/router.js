// Router HTTP mínimo y sin dependencias, basado en coincidencia de rutas.

function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const v = pathParts[i];
    if (p.startsWith(':')) {
      try {
        params[p.slice(1)] = decodeURIComponent(v);
      } catch {
        return null;
      }
    } else if (p !== v) {
      return null;
    }
  }
  return params;
}

export function createRouter() {
  const routes = [];
  const register = (method, pattern, handler) => {
    routes.push({ method: method.toUpperCase(), pattern, handler });
  };

  return {
    add: register,
    get: (p, h) => register('GET', p, h),
    post: (p, h) => register('POST', p, h),
    put: (p, h) => register('PUT', p, h),
    patch: (p, h) => register('PATCH', p, h),
    delete: (p, h) => register('DELETE', p, h),

    async handle(request, ctx, env) {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();

      for (const route of routes) {
        if (route.method !== method) continue;
        const params = matchPath(route.pattern, url.pathname);
        if (params === null) continue;
        return route.handler({ request, params, query: url.searchParams, env, ctx });
      }
      return null;
    },
  };
}
