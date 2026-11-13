// Formato de respuestas JSON consistente.

export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function ok(data = null, meta = undefined) {
  const payload = { success: true, data };
  if (meta !== undefined) payload.meta = meta;
  return json(payload, 200);
}

export function created(data = null) {
  return json({ success: true, data }, 201);
}

export function fail(code, message, status) {
  return json({ success: false, error: { code, message } }, status);
}
