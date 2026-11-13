// Generación de tokens y sesiones (Web Crypto).

import { randomBytes, bytesToBase64Url, sha256Hex } from './crypto.js';

export function generateSessionToken() {
  return bytesToBase64Url(randomBytes(32));
}

export function generateCsrfToken() {
  return bytesToBase64Url(randomBytes(32));
}

export function generateSessionId() {
  return crypto.randomUUID();
}

export async function hashSessionToken(token) {
  return sha256Hex(token);
}
