// Controladores HTTP del usuario autenticado.

import { createAuthService } from '../services/auth.service.js';
import { validateProfileUpdate } from '../validators/auth.validator.js';
import { readJsonBody } from '../utils/http.js';
import { ok } from '../utils/response.js';

export async function updateMe(ctx) {
  const service = createAuthService(ctx.env);
  const body = await readJsonBody(ctx.request);
  const fields = validateProfileUpdate(body);
  const dto = await service.updateProfile(ctx.auth.userId, ctx.auth.csrfToken, fields);
  return ok(dto);
}
