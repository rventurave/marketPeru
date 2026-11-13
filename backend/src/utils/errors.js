// Errores HTTP tipados para la API.

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function badRequest(code, message) {
  return new HttpError(400, code, message);
}

export function unauthorized(code = 'AUTH_REQUIRED', message = 'Autenticación requerida') {
  return new HttpError(401, code, message);
}

export function forbidden(code = 'FORBIDDEN', message = 'Acceso denegado') {
  return new HttpError(403, code, message);
}

export function notFound(code = 'NOT_FOUND', message = 'Recurso no encontrado') {
  return new HttpError(404, code, message);
}

export function conflict(code = 'CONFLICT', message = 'Conflicto') {
  return new HttpError(409, code, message);
}

export function notImplemented(code = 'NOT_IMPLEMENTED', message = 'No implementado en esta etapa') {
  return new HttpError(501, code, message);
}
