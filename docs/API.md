# API REST — MarketPeru

API del backend (Cloudflare Worker). Toda la API se expone bajo el prefijo `/api/`.

- Formato de respuesta exitosa: `{ "success": true, "data": ..., "meta": ... }`.
- Formato de error: `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- Las listas paginadas devuelven `data` como arreglo y `meta` con `{ page, limit, total, totalPages }`.

---

## 1. Convenciones

| Aspecto | Valor |
| --- | --- |
| Base URL | `/api` |
| Formato | JSON |
| Paginación | `page` (default 1), `limit` (default 20, máx. 100) |
| Orden de productos | `sort` = `recent` (default), `price_asc`, `price_desc` |
| Moneda | `PEN` (código ISO) |

---

## 2. Health

### `GET /api/health`

Comprueba que el Worker funciona. No expone secretos.

**Respuesta 200:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "marketperu-api",
    "environment": "development",
    "timestamp": "2026-11-12T00:00:00.000Z"
  }
}
```

---

## 3. Productos (público)

### `GET /api/products`

Lista productos publicados (solo `status = 'active'` y vendedores activos).

**Parámetros de consulta:**

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| `page` | int | Página (default 1) |
| `limit` | int | Resultados por página (default 20, máx. 100) |
| `q` | string | Búsqueda por título/descripción |
| `category_id` | int | Filtrar por categoría |
| `min_price` | number | Precio mínimo |
| `max_price` | number | Precio máximo |
| `location` | string | Filtrar por ubicación |
| `sort` | string | `recent`, `price_asc`, `price_desc` |

**Respuesta 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "iPhone 13",
      "price": 2500,
      "currency": "PEN",
      "condition": "used",
      "location": "Lima",
      "created_at": "2026-11-12T00:00:00.000Z",
      "primary_image": "products/1/a.jpg",
      "category": { "id": 1, "name": "Tecnología", "slug": "tecnologia" },
      "seller": { "id": 2, "name": "Vendedor A", "average_rating": 5, "rating_count": 1 }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### `GET /api/products/:id`

Detalle de un producto público.

**Respuesta 200:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "iPhone 13",
    "description": "celular usado",
    "price": 2500,
    "currency": "PEN",
    "condition": "used",
    "location": "Lima",
    "created_at": "2026-11-12T00:00:00.000Z",
    "category": { "id": 1, "name": "Tecnología", "slug": "tecnologia" },
    "images": [
      { "key": "products/1/a.jpg", "position": 0, "is_primary": true },
      { "key": "products/1/b.jpg", "position": 1, "is_primary": false }
    ],
    "seller": {
      "id": 2,
      "name": "Vendedor A",
      "avatar_url": null,
      "location": "Lima",
      "average_rating": 5,
      "rating_count": 1,
      "joined_at": "2026-11-12T00:00:00.000Z"
    }
  }
}
```

> No se expone email, teléfono, hash de contraseña ni estado del vendedor.

**Errores:** `404 PRODUCT_NOT_FOUND`, `400 INVALID_ID`.

---

## 4. Categorías (público)

### `GET /api/categories`

Lista las categorías disponibles.

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Tecnología", "slug": "tecnologia", "parent_id": null }
  ]
}
```

### `GET /api/categories/:id/products`

Productos publicados de una categoría (paginado; acepta `page`, `limit`, `sort`).

**Errores:** `404 CATEGORY_NOT_FOUND`.

---

## 5. Vendedores (público)

### `GET /api/sellers/:id`

Perfil público del vendedor (identificado por su `id` de usuario).

```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Vendedor A",
    "avatar_url": null,
    "bio": null,
    "location": "Lima",
    "joined_at": "2026-11-12T00:00:00.000Z",
    "average_rating": 5,
    "rating_count": 1,
    "products": {
      "items": [ { "id": 1, "title": "iPhone 13", "price": 2500, "currency": "PEN" } ],
      "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
    }
  }
}
```

> No se expone teléfono ni email. `products` admite `page`, `limit`, `sort`.

### `GET /api/sellers/:id/reviews`

Opiniones del vendedor (paginado).

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "rating": 5,
      "comment": "Excelente",
      "created_at": "2026-11-12T00:00:00.000Z",
      "reviewer": { "id": 5, "name": "Comprador" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Errores:** `404 SELLER_NOT_FOUND`.

---

## 6. Opiniones (público)

### `GET /api/reviews/:id`

Devuelve una opinión pública.

```json
{
  "success": true,
  "data": {
    "id": 1,
    "rating": 5,
    "comment": "Excelente",
    "created_at": "2026-11-12T00:00:00.000Z",
    "reviewer": { "id": 5, "name": "Comprador" }
  }
}
```

**Errores:** `404 REVIEW_NOT_FOUND`.

---

## 7. Rutas privadas (requieren autenticación)

Sin sesión válida devuelven `401 AUTH_REQUIRED`. Con sesión válida devuelven `501 NOT_IMPLEMENTED` (la lógica se implementa en las siguientes etapas).

| Método | Ruta | Operación |
| --- | --- | --- |
| POST | `/api/products` | Crear producto |
| PUT | `/api/products/:id` | Editar producto |
| DELETE | `/api/products/:id` | Eliminar producto |
| GET | `/api/conversations` | Listar conversaciones |
| GET | `/api/conversations/:id/messages` | Listar mensajes |
| POST | `/api/messages` | Enviar mensaje |
| GET | `/api/favorites` | Listar favoritos |
| POST | `/api/favorites` | Guardar favorito |
| DELETE | `/api/favorites/:productId` | Eliminar favorito |
| GET | `/api/transactions` | Listar transacciones |
| GET | `/api/transactions/:id` | Ver transacción |
| POST | `/api/transactions` | Registrar transacción |
| POST | `/api/transactions/:id/confirm` | Confirmar transacción |
| POST | `/api/transactions/:id/cancel` | Cancelar transacción |
| POST | `/api/transactions/:id/dispute` | Abrir disputa |
| POST | `/api/reviews` | Crear calificación |

---

## 8. Autenticación

### `POST /api/auth/register`

Registra un usuario y crea su sesión (cookie `mp_session`).

**Cuerpo (JSON):**

```json
{ "name": "Ana", "email": "ana@example.com", "password": "secreto123", "confirmPassword": "secreto123" }
```

**Reglas:** nombre obligatorio, correo válido y único, contraseña ≥ 8 caracteres con letra y número, `confirmPassword` opcional. El correo se normaliza (trim + minúsculas). El `role` se ignora (nunca se crea admin).

**Respuesta 201:** incluye el usuario, `csrf_token` y `return_to` (si se envió). Establece la cookie de sesión.

**Errores:** `400 NAME_REQUIRED`, `400 INVALID_EMAIL`, `400 WEAK_PASSWORD`, `400 PASSWORD_MISMATCH`, `409 EMAIL_ALREADY_EXISTS`.

### `POST /api/auth/login`

Autentica con correo y contraseña. Acepta `?returnTo=/ruta` (solo rutas internas).

**Errores (genéricos, evitan enumeración):** `401 INVALID_CREDENTIALS` para correo incorrecto, contraseña incorrecta o cuenta suspendida.

**Respuesta 200:** usuario + `csrf_token` + cookie de sesión.

### `POST /api/auth/logout`

Revoca la sesión y borra la cookie. Funciona incluso sin sesión válida.

### `GET /api/auth/me` (requiere sesión)

Devuelve el usuario autenticado: `id`, `name`, `email`, `status`, `created_at`, `csrf_token` y `seller_profile` (si existe). Nunca devuelve `password_hash`, token ni hash de sesión.

**Errores:** `401 AUTH_REQUIRED`, `401 SESSION_EXPIRED`, `403 ACCOUNT_SUSPENDED`.

### `PATCH /api/users/me` (requiere sesión + CSRF)

Actualiza `name`, `bio` y `location`. Requiere cabecera `X-CSRF-Token` (el valor se obtiene en `/auth/me` o al iniciar sesión). No permite modificar `id`, `email`, `role`, reputación ni estado.

**Errores:** `401 AUTH_REQUIRED`, `403 CSRF_TOKEN_INVALID`, `400` (validación).

> La cookie es `HttpOnly`, `SameSite=Lax`, `Path=/`, con `Max-Age` (30 días) y `Secure` en producción. El token de sesión se almacena hasheado en D1; el original solo viaja en la cookie.

---

## 9. Códigos de error

| Código | HTTP | Significado |
| --- | --- | --- |
| `INVALID_PARAMETER` | 400 | Parámetro inválido |
| `INVALID_ID` | 400 | Identificador inválido |
| `INVALID_SORT` | 400 | Orden no permitido |
| `INVALID_MIN_PRICE` / `INVALID_MAX_PRICE` | 400 | Precio inválido |
| `INVALID_PRICE_RANGE` | 400 | `min_price > max_price` |
| `INVALID_CONTENT_TYPE` | 400 | `Content-Type` no es JSON |
| `PAYLOAD_TOO_LARGE` | 400 | Cuerpo demasiado grande |
| `NAME_REQUIRED` / `EMAIL_REQUIRED` / `PASSWORD_REQUIRED` | 400 | Campo obligatorio |
| `INVALID_EMAIL` | 400 | Correo inválido |
| `WEAK_PASSWORD` | 400 | Contraseña débil |
| `PASSWORD_MISMATCH` | 400 | Contraseñas no coinciden |
| `EMAIL_ALREADY_EXISTS` | 409 | Correo ya registrado |
| `AUTH_REQUIRED` | 401 | Ruta privada sin sesión |
| `SESSION_EXPIRED` | 401 | Sesión expirada |
| `INVALID_CREDENTIALS` | 401 | Credenciales inválidas (genérico) |
| `ACCOUNT_SUSPENDED` | 403 | Cuenta no activa |
| `FORBIDDEN` | 403 | Acceso denegado |
| `CSRF_TOKEN_INVALID` | 403 | Token CSRF inválido |
| `CSRF_ORIGIN_INVALID` | 403 | Origen no permitido |
| `PRODUCT_NOT_FOUND` | 404 | Producto no encontrado |
| `CATEGORY_NOT_FOUND` | 404 | Categoría no encontrada |
| `SELLER_NOT_FOUND` | 404 | Vendedor no encontrado |
| `REVIEW_NOT_FOUND` | 404 | Opinión no encontrada |
| `NOT_FOUND` | 404 | Ruta no encontrada |
| `RATE_LIMITED` | 429 | Demasiadas solicitudes |
| `NOT_IMPLEMENTED` | 501 | Endpoint reservado (aún no implementado) |
| `INTERNAL_ERROR` | 500 | Error interno |

No se exponen errores SQL ni stack traces al cliente.

---

## 10. Ejemplos

```bash
# Listar productos (búsqueda + filtro + orden)
curl "http://localhost:8787/api/products?q=iphone&min_price=1000&sort=price_desc"

# Detalle de producto
curl "http://localhost:8787/api/products/1"

# Categorías
curl "http://localhost:8787/api/categories"

# Productos de una categoría
curl "http://localhost:8787/api/categories/1/products"

# Perfil de vendedor
curl "http://localhost:8787/api/sellers/2"

# Opiniones de un vendedor
curl "http://localhost:8787/api/sellers/2/reviews"
```

---

## 11. Seguridad

- Los nombres de columna de `ORDER BY` no son controlados por el cliente (lista blanca).
- Toda consulta usa **prepared statements** (parámetros enlazados).
- Las rutas privadas están protegidas por `requireAuth()` en el backend (además de los triggers de la base de datos).
- Contraseñas con **PBKDF2-SHA256** (salt por contraseña, 100 000 iteraciones, 256 bits), nunca texto plano.
- Sesiones con token aleatorio (Web Crypto), almacenado **hasheado** en D1; el original solo viaja en cookie `HttpOnly`.
- Cookies: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` (30 días), `Secure` en producción.
- Protección CSRF: token por sesión (cabecera `X-CSRF-Token`) + validación de `Origin` en operaciones de estado.
- Login/registro con mensajes genéricos (anti-enumeración) y rate limiting específico.
- CORS restringido a `ALLOWED_ORIGINS` (nunca `Access-Control-Allow-Origin: *` con credenciales).
- No se exponen bindings D1/R2, secretos ni información privada de usuarios.
