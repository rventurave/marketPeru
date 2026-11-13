// Estado de autenticación y flujo de login/registro/logout.

import { api, setCsrfToken } from './api.js';

let currentUser = null;

export function getUser() {
  return currentUser;
}

export function isAuthenticated() {
  return !!currentUser;
}

export async function fetchMe() {
  try {
    const data = await api.get('/api/auth/me');
    currentUser = data.data;
    setCsrfToken(data.data.csrf_token);
    return currentUser;
  } catch (err) {
    currentUser = null;
    setCsrfToken(null);
    if (err.status === 401 || err.status === 403) return null;
    throw err;
  }
}

export async function login(email, password) {
  const data = await api.post('/api/auth/login', { email, password });
  currentUser = data.data;
  setCsrfToken(data.data.csrf_token);
  return currentUser;
}

export async function register(payload) {
  const data = await api.post('/api/auth/register', payload);
  currentUser = data.data;
  setCsrfToken(data.data.csrf_token);
  return currentUser;
}

export async function logout() {
  try {
    await api.post('/api/auth/logout');
  } finally {
    currentUser = null;
    setCsrfToken(null);
  }
}

// Valida una ruta de retorno interna (evita open redirects).
export function safeReturnTo(value) {
  if (typeof value !== 'string' || value === '') return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return null;
  if (value.includes('\\')) return null;
  return value;
}

export function redirectAfterAuth() {
  const params = new URLSearchParams(window.location.search);
  const returnTo = safeReturnTo(params.get('returnTo'));
  window.location.href = returnTo || 'index.html';
}

// Redirige a login conservando la ruta actual como returnTo.
export function redirectToLogin(returnTo) {
  const safe = safeReturnTo(returnTo) || 'index.html';
  window.location.href = `login.html?returnTo=${encodeURIComponent(safe)}`;
}
