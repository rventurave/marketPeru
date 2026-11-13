// Validación de parámetros de consulta. El cliente nunca controla los nombres
// de columna usados en ORDER BY; solo se aceptan claves de una lista blanca.

import { badRequest } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';

const SORTS = {
  recent: 'p.created_at DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
};

function parseId(value, name) {
  if (value === null || value === undefined || value === '') {
    throw badRequest('INVALID_PARAMETER', `El parámetro "${name}" es obligatorio`);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest('INVALID_ID', `"${name}" debe ser un identificador entero positivo`);
  }
  return n;
}

function optionalInt(value, name) {
  if (value === null || value === undefined || value === '') return null;
  return parseId(value, name);
}

function optionalNumber(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw badRequest('INVALID_PARAMETER', `"${name}" debe ser un número`);
  }
  return n;
}

function optionalText(value, name, maxLength = 200) {
  if (value === null || value === undefined) return null;
  const text = value.trim();
  if (text === '') return null;
  if (text.length > maxLength) {
    throw badRequest('INVALID_PARAMETER', `"${name}" no puede superar ${maxLength} caracteres`);
  }
  return text;
}

export function parseIdParam(params, name = 'id') {
  return parseId(params[name], name);
}

export function parseSort(searchParams) {
  const sortKey = searchParams.get('sort') || 'recent';
  if (!(sortKey in SORTS)) {
    throw badRequest(
      'INVALID_SORT',
      `El orden "${sortKey}" no es válido. Valores permitidos: ${Object.keys(SORTS).join(', ')}`,
    );
  }
  return SORTS[sortKey];
}

export function parseListQuery(searchParams) {
  const { page, limit, offset } = parsePagination(searchParams);
  const sort = parseSort(searchParams);
  return { page, limit, offset, sort };
}

export function parseProductListQuery(searchParams) {
  const list = parseListQuery(searchParams);

  const q = optionalText(searchParams.get('q'), 'q');
  const categoryId = optionalInt(searchParams.get('category_id'), 'category_id');
  const minPrice = optionalNumber(searchParams.get('min_price'), 'min_price');
  const maxPrice = optionalNumber(searchParams.get('max_price'), 'max_price');
  const location = optionalText(searchParams.get('location'), 'location');

  if (minPrice !== null && minPrice < 0) {
    throw badRequest('INVALID_MIN_PRICE', 'min_price no puede ser negativo');
  }
  if (maxPrice !== null && maxPrice < 0) {
    throw badRequest('INVALID_MAX_PRICE', 'max_price no puede ser negativo');
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw badRequest('INVALID_PRICE_RANGE', 'min_price no puede ser mayor que max_price');
  }

  return { ...list, q, categoryId, minPrice, maxPrice, location };
}
