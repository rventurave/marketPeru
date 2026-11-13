// Hash y verificación de contraseñas.
//
// Algoritmo: PBKDF2-SHA256 (Web Crypto, nativo en Workers), con salt aleatorio
// por contraseña y parámetros almacenados junto al hash para permitir
// actualizaciones futuras.
//
// Formato almacenado: pbkdf2-sha256$<iterations>$<salt_b64url>$<hash_b64url>

import {
  randomBytes,
  bytesToBase64Url,
  base64UrlToBytes,
  timingSafeEqual,
} from './crypto.js';

const ITERATIONS = 100000;
const KEY_LENGTH_BYTES = 32; // 256 bits
const SALT_LENGTH_BYTES = 16;

const enc = new TextEncoder();

async function derive(password, salt, iterations, keyLength) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    keyLength * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const hash = await derive(password, salt, ITERATIONS, KEY_LENGTH_BYTES);
  return `pbkdf2-sha256$${ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;

  const iterations = Number(parts[1]);
  const salt = base64UrlToBytes(parts[2]);
  const expected = base64UrlToBytes(parts[3]);

  const derived = await derive(password, salt, iterations, expected.length);
  return timingSafeEqual(derived, expected);
}
