// Utilidades HTTP: lectura de JSON con validación y saneamiento de rutas de retorno.

import { badRequest } from './errors.js';

export async function readJsonBody(request, { maxBytes = 1024 * 1024 } = {}) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw badRequest('INVALID_CONTENT_TYPE', 'Se requiere Content-Type application/json');
  }

  const contentLength = request.headers.get('Content-Length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw badRequest('PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande');
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    throw badRequest('PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('INVALID_JSON', 'El cuerpo no es un JSON válido');
  }
}

// Solo permite rutas internas relativas (evita open redirects y URLs externas).
export function sanitizeReturnTo(value) {
  if (typeof value !== 'string' || value === '') return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return null;
  if (value.includes('\\')) return null;
  return value;
}
