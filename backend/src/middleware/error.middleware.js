// Manejo centralizado de errores. No expone SQL ni stack traces al cliente.

import { HttpError } from '../utils/errors.js';
import { fail } from '../utils/response.js';

export function handleError(err) {
  if (err instanceof HttpError) {
    return fail(err.code, err.message, err.status);
  }
  console.error(err);
  return fail('INTERNAL_ERROR', 'Error interno del servidor', 500);
}
