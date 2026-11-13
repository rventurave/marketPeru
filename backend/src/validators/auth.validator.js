// Validación de entradas para autenticación y perfil.

import { badRequest } from '../utils/errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_NAME = 100;
const MAX_BIO = 1000;
const MAX_LOCATION = 200;

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  return value.trim().toLowerCase();
}

function normalizeName(value) {
  if (typeof value !== 'string') return null;
  return value.trim();
}

function isStrongPassword(p) {
  if (typeof p !== 'string' || p.length < 8 || p.length > 128) return false;
  return /[a-zA-Z]/.test(p) && /[0-9]/.test(p);
}

export function validateRegister(body = {}) {
  const name = normalizeName(body.name);
  const email = normalizeEmail(body.email);
  const password = body.password;
  const confirmPassword = body.confirmPassword;

  if (!name) throw badRequest('NAME_REQUIRED', 'El nombre es obligatorio');
  if (name.length > MAX_NAME) throw badRequest('NAME_TOO_LONG', `El nombre no puede superar ${MAX_NAME} caracteres`);

  if (!email) throw badRequest('EMAIL_REQUIRED', 'El correo es obligatorio');
  if (email.length > MAX_EMAIL) throw badRequest('EMAIL_TOO_LONG', 'El correo es demasiado largo');
  if (!EMAIL_RE.test(email)) throw badRequest('INVALID_EMAIL', 'El correo no es válido');

  if (!password) throw badRequest('PASSWORD_REQUIRED', 'La contraseña es obligatoria');
  if (!isStrongPassword(password)) {
    throw badRequest('WEAK_PASSWORD', 'La contraseña debe tener al menos 8 caracteres, una letra y un número');
  }
  if (confirmPassword !== undefined && confirmPassword !== password) {
    throw badRequest('PASSWORD_MISMATCH', 'Las contraseñas no coinciden');
  }

  return { name, email, password };
}

export function validateLogin(body = {}) {
  const email = normalizeEmail(body.email);
  const password = body.password;

  if (!email) throw badRequest('EMAIL_REQUIRED', 'El correo es obligatorio');
  if (!password) throw badRequest('PASSWORD_REQUIRED', 'La contraseña es obligatoria');

  return { email, password };
}

export function validateProfileUpdate(body = {}) {
  const fields = {};

  if (body.name !== undefined) {
    const name = normalizeName(body.name);
    if (!name) throw badRequest('NAME_REQUIRED', 'El nombre no puede estar vacío');
    if (name.length > MAX_NAME) throw badRequest('NAME_TOO_LONG', `El nombre no puede superar ${MAX_NAME} caracteres`);
    fields.name = name;
  }

  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') throw badRequest('INVALID_BIO', 'La descripción debe ser texto');
    const bio = body.bio.trim();
    if (bio.length > MAX_BIO) throw badRequest('BIO_TOO_LONG', `La descripción no puede superar ${MAX_BIO} caracteres`);
    fields.bio = bio;
  }

  if (body.location !== undefined) {
    if (typeof body.location !== 'string') throw badRequest('INVALID_LOCATION', 'La ubicación debe ser texto');
    const location = body.location.trim();
    if (location.length > MAX_LOCATION) throw badRequest('LOCATION_TOO_LONG', `La ubicación no puede superar ${MAX_LOCATION} caracteres`);
    fields.location = location;
  }

  return fields;
}
