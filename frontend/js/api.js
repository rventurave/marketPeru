// Cliente HTTP centralizado: credenciales, errores, JSON y token CSRF.

import { API_BASE } from './config.js';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = token;
}

async function request(method, path, { body, csrf = false } = {}) {
  const headers = {};
  const opts = { method, headers, credentials: 'include' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  if (csrf) {
    if (!csrfToken) throw new ApiError(0, 'CSRF_MISSING', 'No hay token CSRF disponible');
    headers['X-CSRF-Token'] = csrfToken;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const code = data?.error?.code || 'ERROR';
    const message = data?.error?.message || 'Error del servidor';
    throw new ApiError(res.status, code, message);
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body, opts = {}) => request('POST', path, { body, ...opts }),
  patch: (path, body, opts = {}) => request('PATCH', path, { body, ...opts }),
};
