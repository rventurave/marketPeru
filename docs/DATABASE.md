# Base de datos — MarketPeru

Modelo relacional implementado para **Cloudflare D1** (SQL, compatible con SQLite).

Las migraciones viven en `database/migrations/` y las pruebas en `database/tests/`.

---

## 1. Convenciones

- Claves primarias: `INTEGER PRIMARY KEY` (rowid, auto-asignado). Se evita `AUTOINCREMENT` por compatibilidad con D1.
- Fechas: `TEXT` en formato **ISO 8601 UTC con milisegundos** (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`).
- Toda lectura/escritura usa **consultas parametrizadas**.
- Integridad referencial **habilitada** (`PRAGMA foreign_keys = ON`). D1 la habilita por defecto; verificar con `PRAGMA foreign_keys`.
- Restricciones `UNIQUE`, `CHECK` y claves foráneas (`REFERENCES`) en el esquema.
- Validaciones entre tablas mediante **triggers** (lo que CHECK/FK no pueden expresar).

---

## 2. Diagrama entidad-relación

```
users 1 ──── 1 seller_profiles        (perfil de vendedor opcional)
users 1 ──── N sessions
users 1 ──── N products               (como vendedor)
users 1 ──── N favorites
users 1 ──── N conversations          (como comprador o vendedor)
users 1 ──── N messages               (como remitente)
users 1 ──── N transactions           (como comprador o vendedor)
users 1 ──── N seller_reviews         (como reviewer o reviewee)
users 1 ──── N reports                (como reporter o usuario reportado)

categories 1 ──── N categories        (jerarquía: parent_id)
categories 1 ──── N products

products 1 ──── N product_images
products 1 ──── N favorites
products 1 ──── N conversations
products 1 ──── N transactions
products 1 ──── N reports             (target_type = 'product')

conversations 1 ──── N messages
conversations 1 ──── N reports        (target_type = 'message' vía messages)

transactions 1 ──── N seller_reviews
```

---

## 3. Tablas

### users — cuentas de usuario

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `email` | TEXT | NOT NULL, UNIQUE | Correo de acceso |
| `password_hash` | TEXT | NOT NULL | Hash de la contraseña |
| `name` | TEXT | NOT NULL | Nombre visible |
| `role` | TEXT | NOT NULL, DEFAULT `'user'`, CHECK | `user` o `admin` |
| `status` | TEXT | NOT NULL, DEFAULT `'active'`, CHECK | `active`, `suspended`, `banned` |
| `avatar_url` | TEXT | NULL | Clave/URL del avatar |
| `created_at` | TEXT | NOT NULL | ISO 8601 |
| `updated_at` | TEXT | NOT NULL | ISO 8601 |

### sessions — sesiones autenticadas

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | TEXT | PK | Identificador de sesión |
| `user_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE CASCADE | Usuario |
| `token_hash` | TEXT | NOT NULL, UNIQUE | Hash del token |
| `csrf_token` | TEXT | NOT NULL | Token CSRF |
| `expires_at` | TEXT | NOT NULL | Expiración |
| `created_at` | TEXT | NOT NULL | ISO 8601 |

> La cookie guarda el token sin procesar; en D1 solo el hash.

### seller_profiles — perfil público del vendedor

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `user_id` | INTEGER | NOT NULL, UNIQUE, FK → users.id, ON DELETE CASCADE | Usuario vendedor |
| `display_name` | TEXT | NOT NULL | Nombre público |
| `bio` | TEXT | NULL | Descripción |
| `location` | TEXT | NULL | Ubicación |
| `phone` | TEXT | NULL | Contacto opcional |
| `average_rating` | REAL | NOT NULL, DEFAULT 0 | Calificación promedio (derivada) |
| `rating_count` | INTEGER | NOT NULL, DEFAULT 0 | Número de calificaciones |
| `created_at` | TEXT | NOT NULL | ISO 8601 |
| `updated_at` | TEXT | NOT NULL | ISO 8601 |

> `average_rating` y `rating_count` se mantienen mediante triggers al insertar/eliminar `seller_reviews`.

### categories — categorías de productos

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `name` | TEXT | NOT NULL | Nombre |
| `slug` | TEXT | NOT NULL, UNIQUE | Identificador estable |
| `parent_id` | INTEGER | NULL, FK → categories.id, ON DELETE SET NULL | Categoría padre |

### products — publicaciones

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `seller_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE RESTRICT | Vendedor propietario |
| `title` | TEXT | NOT NULL | Título |
| `description` | TEXT | NULL | Descripción |
| `price` | REAL | NOT NULL, CHECK `>= 0` | Precio |
| `currency` | TEXT | NOT NULL, DEFAULT `'PEN'`, CHECK 3 letras mayúsculas | Moneda ISO |
| `category_id` | INTEGER | NOT NULL, FK → categories.id, ON DELETE RESTRICT | Categoría |
| `condition` | TEXT | NOT NULL, DEFAULT `'used'`, CHECK | `new` o `used` |
| `status` | TEXT | NOT NULL, DEFAULT `'active'`, CHECK | `active`, `sold`, `hidden`, `removed` |
| `location` | TEXT | NULL | Ubicación |
| `created_at` | TEXT | NOT NULL | ISO 8601 |
| `updated_at` | TEXT | NOT NULL | ISO 8601 |

> El trigger `trg_products_seller_profile_*` exige que `seller_id` tenga `seller_profile`.

### product_images — fotografías (referencias R2)

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `product_id` | INTEGER | NOT NULL, FK → products.id, ON DELETE CASCADE | Producto |
| `r2_key` | TEXT | NOT NULL | Clave del objeto en R2 |
| `position` | INTEGER | NOT NULL, DEFAULT 0, CHECK `>= 0` | Orden |
| `is_primary` | INTEGER | NOT NULL, DEFAULT 0, CHECK `IN (0,1)` | Imagen principal |
| `created_at` | TEXT | NOT NULL | ISO 8601 |

> Solo se guarda la clave R2; el binario vive en R2.

### favorites — productos guardados

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `user_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE CASCADE | Usuario |
| `product_id` | INTEGER | NOT NULL, FK → products.id, ON DELETE CASCADE | Producto |
| `created_at` | TEXT | NOT NULL | ISO 8601 |

- `UNIQUE(user_id, product_id)`.

### conversations — conversaciones

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `buyer_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE RESTRICT | Comprador |
| `seller_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE RESTRICT | Vendedor |
| `product_id` | INTEGER | NOT NULL, FK → products.id, ON DELETE RESTRICT | Producto |
| `created_at` | TEXT | NOT NULL | ISO 8601 |
| `updated_at` | TEXT | NOT NULL | ISO 8601 |

- `CHECK (buyer_id <> seller_id)`.
- `UNIQUE(buyer_id, seller_id, product_id)`.

### messages — mensajes

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `conversation_id` | INTEGER | NOT NULL, FK → conversations.id, ON DELETE CASCADE | Conversación |
| `sender_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE RESTRICT | Remitente |
| `body` | TEXT | NOT NULL | Contenido |
| `created_at` | TEXT | NOT NULL | ISO 8601 |
| `read_at` | TEXT | NULL | Fecha de lectura |

> El trigger `trg_messages_sender_is_participant` exige que `sender_id` sea comprador o vendedor de la conversación.

### transactions — acuerdos entre comprador y vendedor

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `buyer_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE RESTRICT | Comprador |
| `seller_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE RESTRICT | Vendedor |
| `product_id` | INTEGER | NOT NULL, FK → products.id, ON DELETE RESTRICT | Producto |
| `status` | TEXT | NOT NULL, DEFAULT `'pending'`, CHECK | `pending`, `completed`, `cancelled`, `disputed` |
| `buyer_confirmed_at` | TEXT | NULL | Confirmación del comprador |
| `seller_confirmed_at` | TEXT | NULL | Confirmación del vendedor |
| `completed_at` | TEXT | NULL | Fecha de completado |
| `cancelled_at` | TEXT | NULL | Fecha de cancelación |
| `cancelled_by` | INTEGER | NULL, FK → users.id, ON DELETE SET NULL | Quién canceló |
| `disputed_at` | TEXT | NULL | Fecha de apertura de disputa |
| `disputed_by` | INTEGER | NULL, FK → users.id, ON DELETE SET NULL | Quién abrió la disputa |
| `dispute_reason` | TEXT | NULL | Motivo de la disputa |
| `resolved_at` | TEXT | NULL | Fecha de resolución |
| `created_at` | TEXT | NOT NULL | ISO 8601 |
| `updated_at` | TEXT | NOT NULL | ISO 8601 |

- `CHECK (buyer_id <> seller_id)`.
- Trigger `trg_transactions_product_seller`: el producto debe pertenecer al vendedor.
- Trigger `trg_transactions_completed_guard`: no se puede pasar a `completed` sin confirmación de ambas partes.

### seller_reviews — calificaciones de vendedores

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `transaction_id` | INTEGER | NOT NULL, FK → transactions.id, ON DELETE RESTRICT | Transacción vinculada |
| `reviewer_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE RESTRICT | Comprador que califica |
| `reviewee_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE RESTRICT | Vendedor calificado |
| `rating` | INTEGER | NOT NULL, CHECK 1–5 | Calificación |
| `comment` | TEXT | NULL | Comentario |
| `created_at` | TEXT | NOT NULL | ISO 8601 |

- `CHECK (reviewer_id <> reviewee_id)`.
- `UNIQUE(transaction_id, reviewer_id)`.
- Trigger `trg_seller_reviews_validate_insert`: solo transacción `completed` con reviewer = comprador y reviewee = vendedor.
- Triggers de reputación: mantienen `seller_profiles.average_rating` y `rating_count`.

### reports — reportes de contenido

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | Identificador |
| `reporter_id` | INTEGER | NOT NULL, FK → users.id, ON DELETE CASCADE | Quién reporta |
| `target_type` | TEXT | NOT NULL, CHECK | `product`, `user`, `message` |
| `product_id` | INTEGER | NULL, FK → products.id, ON DELETE CASCADE | Producto reportado |
| `reported_user_id` | INTEGER | NULL, FK → users.id, ON DELETE CASCADE | Usuario reportado |
| `message_id` | INTEGER | NULL, FK → messages.id, ON DELETE CASCADE | Mensaje reportado |
| `reason` | TEXT | NOT NULL | Motivo |
| `description` | TEXT | NULL | Detalle |
| `status` | TEXT | NOT NULL, DEFAULT `'pending'`, CHECK | `pending`, `reviewed`, `resolved`, `dismissed` |
| `created_at` | TEXT | NOT NULL | ISO 8601 |
| `resolved_at` | TEXT | NULL | Fecha de resolución |

- `CHECK` garantiza exactamente un objetivo según `target_type`.

---

## 4. Estados de las entidades

| Entidad | Columna | Estados |
| --- | --- | --- |
| users | `status` | `active`, `suspended`, `banned` |
| products | `status` | `active`, `sold`, `hidden`, `removed` |
| products | `condition` | `new`, `used` |
| transactions | `status` | `pending`, `completed`, `cancelled`, `disputed` |
| reports | `status` | `pending`, `reviewed`, `resolved`, `dismissed` |

---

## 5. Flujo de transacciones (confirmación bilateral y disputas)

```
[registro]  pending
    │
    ├── comprador confirma (buyer_confirmed_at)
    ├── vendedor confirma (seller_confirmed_at)
    │
    ├── AMBAS confirmaciones ──────> completed  (habilita calificación)
    │
    ├── una parte cancela (antes de completar) ──> cancelled
    │
    └── se abre disputa (antes de completar) ───> disputed
                                                  │
                                                  └── resolución -> completed | cancelled
```

Reglas:

1. Una transacción se crea en `pending`.
2. Para pasar a `completed`, **ambas partes** deben confirmar (`buyer_confirmed_at` y `seller_confirmed_at` no nulos). Lo garantiza el trigger `trg_transactions_completed_guard`; una sola parte **no** puede completarla.
3. `cancelled` y `disputed` **no** habilitan calificación.
4. El vendedor no puede transaccionar consigo mismo (`CHECK buyer_id <> seller_id`).
5. El producto debe pertenecer al vendedor (trigger).
6. La transición entre estados (incluyendo disputas y su resolución) la orquesta el backend con actualizaciones condicionales (`UPDATE ... WHERE status = ...`), documentado para implementación.

---

## 6. Flujo de calificaciones

1. Solo se puede calificar una transacción en estado `completed` (trigger).
2. El `reviewer` debe ser el comprador y el `reviewee` el vendedor (trigger).
3. `rating` entre 1 y 5 (CHECK).
4. No puede calificarse a sí mismo (`CHECK reviewer_id <> reviewee_id`, reforzado por el trigger).
5. Una sola opinión por comprador y transacción (`UNIQUE(transaction_id, reviewer_id)`).
6. Al insertar/eliminar una opinión, se recalculan `average_rating` y `rating_count` del vendedor (triggers).

---

## 7. Índices

En `0002_indexes.sql`:

- `products`: `created_at DESC`, `price`, `(seller_id, status)`, `(category_id, status)`, `(status, created_at DESC)`.
- `product_images`: `(product_id)`.
- `favorites`: `(product_id)`.
- `conversations`: `(seller_id)`, `(seller_id, buyer_id)`, `(product_id)`.
- `messages`: `(conversation_id, created_at)`.
- `transactions`: `(buyer_id, seller_id)`, `(seller_id, buyer_id)`, `(product_id)`, `(status)`.
- `seller_reviews`: `(reviewee_id)`.
- `sessions`: `(user_id, expires_at)`, `(expires_at)`.
- `reports`: `(status)`, `(reporter_id)`.

Los índices `UNIQUE` implícitos ya cubren: `users.email`, `sessions.token_hash`, `seller_profiles.user_id`, `categories.slug`, `favorites(user_id, product_id)`, `conversations(buyer_id, seller_id, product_id)`, `seller_reviews(transaction_id, reviewer_id)`.

---

## 8. Reglas de integridad y dónde se aplican

| Regla | Implementación |
| --- | --- |
| Email único | `UNIQUE(email)` |
| Precio no negativo | `CHECK (price >= 0)` |
| Moneda ISO | `CHECK (currency = upper(currency) AND length(currency) = 3)` |
| Rating 1–5 | `CHECK (rating BETWEEN 1 AND 5)` |
| Producto con vendedor válido | FK `seller_id → users` + trigger de perfil de vendedor |
| Producto con categoría válida | FK `category_id → categories` (NOT NULL) |
| Vendedor no se transacciona consigo mismo | `CHECK (buyer_id <> seller_id)` |
| No calificarse a sí mismo | `CHECK (reviewer_id <> reviewee_id)` + trigger |
| Una calificación por comprador y transacción | `UNIQUE(transaction_id, reviewer_id)` |
| Solo calificar transacción completada | Trigger de validación |
| Favorito no duplicado | `UNIQUE(user_id, product_id)` |
| Conversación con usuarios válidos | FK `buyer_id`/`seller_id` + `CHECK (buyer_id <> seller_id)` |
| Mensaje solo de participante | Trigger de participación |
| Integridad referencial | FKs con `ON DELETE` explícito |

> Reglas que dependen de lógica de negocio (no expresables solo en DDL): secuencia completa de estados de transacción/disputas y orquestación de cancelaciones/resoluciones. Se implementarán en `backend/src/services/` usando actualizaciones condicionales y transacciones.

---

## 9. Migraciones

Archivos en `database/migrations/` (ordenados y reproducibles):

| Archivo | Contenido |
| --- | --- |
| `0001_initial_schema.sql` | Tablas, FKs, CHECKs y triggers |
| `0002_indexes.sql` | Índices |
| `0003_seed_categories.sql` | Categorías iniciales (idempotente) |

### Ejecución local (Wrangler / D1)

```bash
cd backend
npx wrangler d1 execute marketperu --local --file=../database/migrations/0001_initial_schema.sql
npx wrangler d1 execute marketperu --local --file=../database/migrations/0002_indexes.sql
npx wrangler d1 execute marketperu --local --file=../database/migrations/0003_seed_categories.sql
```

O con los scripts de `package.json`:

```bash
npm run db:migrate:local
```

### Ejecución remota (solo cuando se configure la cuenta)

```bash
npm run db:migrate:remote
```

### Pruebas

```bash
npm run test:db
```

Las pruebas aplican las migraciones a una base SQLite en memoria (mismo motor que D1) y verifican integridad, restricciones y flujos.

---

## 10. Decisiones y cambios

- **Moneda**: `PEN` como moneda inicial (código ISO), con CHECK de 3 letras mayúsculas.
- **Transacciones**: se eliminó el estado `agreed` original y se reemplazó por confirmación bilateral (`buyer_confirmed_at` + `seller_confirmed_at`) con estados `pending`/`completed`/`cancelled`/`disputed`.
- **Calificaciones**: se renombró `reviews` → `seller_reviews` y se añadió validación por trigger (transacción completada + partes coincidentes).
- **Reportes**: ahora soportan producto, usuario o mensaje (`target_type` + FKs polimórficas).
- **Imágenes (R2)**: no se almacenan binarios en D1; solo referencias. Límites (validados en backend): JPEG/PNG/WebP, máx. 5 MB por imagen, máx. 8 imágenes por producto.
- **Claves primarias**: se usa `INTEGER PRIMARY KEY` (sin `AUTOINCREMENT`) por compatibilidad con D1.
