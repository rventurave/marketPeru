// Utilidades de paginación.

import { badRequest } from './errors.js';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parsePositiveInt(value, name, { defaultValue, max } = {}) {
  if (value === null || value === undefined || value === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw badRequest('INVALID_PARAMETER', `El parámetro "${name}" es obligatorio`);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest('INVALID_PARAMETER', `El parámetro "${name}" debe ser un entero positivo`);
  }
  if (max !== undefined && n > max) {
    throw badRequest('INVALID_PARAMETER', `El parámetro "${name}" no puede superar ${max}`);
  }
  return n;
}

export function parsePagination(searchParams) {
  const page = parsePositiveInt(searchParams.get('page'), 'page', { defaultValue: 1 });
  const limit = parsePositiveInt(searchParams.get('limit'), 'limit', {
    defaultValue: DEFAULT_LIMIT,
    max: MAX_LIMIT,
  });
  return { page, limit, offset: (page - 1) * limit };
}

export function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
