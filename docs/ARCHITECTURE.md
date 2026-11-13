# Arquitectura — MarketPeru

Este documento define la arquitectura técnica del marketplace. Es la referencia principal para el desarrollo de las siguientes etapas.

---

## 1. Visión general del sistema

MarketPeru es un marketplace en el que:

- Los **visitantes** pueden explorar productos, buscar, filtrar y consultar perfiles públicos de vendedores **sin registrarse**.
- Los **usuarios autenticados** pueden contactar vendedores, enviar mensajes, guardar favoritos y realizar acciones personales.
- Los **vendedores** tienen un perfil público con reputación de 1 a 5 estrellas, basada en opiniones vinculadas a transacciones verificadas.
- No se implementan pagos electrónicos en la primera versión.

El sistema se compone de:

1. **Frontend** (JavaScript puro) servido como contenido estático.
2. **Backend** (Cloudflare Worker) que expone una API REST bajo `/api/*`.
3. **Base de datos** (Cloudflare D1) para datos relacionales.
4. **Almacenamiento de objetos** (Cloudflare R2) para fotografías.

### Principio de acceso

El frontend **nunca** accede directamente a D1 ni a R2. Toda operación sensible pasa por el backend, que es el único componente autorizado para leer/escribir la base de datos y el almacenamiento.

---

## 2. Arquitectura propuesta

```
[ Navegador ]
    |
    | HTTP / HTTPS (Fetch API)
    v
[ Cloudflare Worker (backend) ]  --------leer/escribir-----> [ D1 ]
    |                              \-------leer/escribir-----> [ R2 ]
    | (sirve estáticos + API /api/*)
    |
    v
[ Frontend (HTML/CSS/JS estático) ]
```

### Capas

- **Presentación** — HTML, CSS y JavaScript en el navegador. Se comunica solo con la API.
- **Comunicación con API** — Módulo `js/api/client.js` que encapsula `fetch`, cookies de sesión, manejo de errores y cabeceras comunes.
- **Lógica de negocio** — Reside en el backend (`services/`). El frontend solo orquesta la UI y muestra datos.
- **Rutas del backend** — `routes/` mapea URLs HTTP a controladores.
- **Servicios** — `services/` implementa las reglas de negocio (autenticación, publicación, reputación, mensajería, etc.).
- **Middleware** — `middleware/` ejecuta validaciones transversales (autenticación, permisos, CSRF, rate limit, validación de entrada, errores).
- **Persistencia de datos** — D1 mediante consultas SQL parametrizadas.
- **Almacenamiento de imágenes** — R2 mediante la API de Workers (binding).

### Flujo general de una petición

```
Solicitud HTTP
  -> enrutador (index.js)
    -> middleware de autenticación/permisos/validación
      -> controlador (routes/controllers)
        -> servicio (lógica de negocio)
          -> repositorio/consultas D1 o R2
        <- respuesta normalizada
      <- middleware de errores
  <- JSON / recurso estático
```

---

## 3. Estructura de carpetas

```
marketPeru/
├── frontend/                 # Presentación (JavaScript puro, sin frameworks)
│   ├── index.html            # Catálogo con búsqueda y filtros
│   ├── product.html          # Detalle de producto
│   ├── seller.html           # Perfil público de vendedor
│   ├── login.html            # Inicio de sesión
│   ├── register.html         # Registro
│   ├── profile.html          # Perfil personal
│   ├── publish.html          # Publicar (interfaz; backend pendiente)
│   ├── dashboard.html        # Panel de usuario
│   ├── css/                  # Sistema de diseño (variables, componentes, responsive)
│   ├── js/                   # api.js, auth.js, navigation.js y módulos por dominio
│   └── assets/               # Imágenes y recursos estáticos
├── backend/
│   ├── src/
│   │   ├── index.js        # Punto de entrada: enrutador, CORS, rate limit, errores
│   │   ├── router.js       # Enrutador HTTP mínimo
│   │   ├── routes/         # Definición de rutas REST (públicas y privadas)
│   │   ├── controllers/    # Controladores HTTP (parseo y respuestas)
│   │   ├── services/       # Lógica de negocio y DTOs públicos
│   │   ├── repositories/   # Consultas SQL (D1, prepared statements)
│   │   ├── middleware/     # Auth, CORS, rate limit, errores
│   │   ├── validators/     # Validación de parámetros de consulta
│   │   └── utils/          # Respuestas, errores, paginación
│   ├── test/               # Pruebas de integración (Vitest + Workers)
│   ├── vitest.config.js    # Configuración de pruebas
│   ├── wrangler.toml       # Configuración del Worker + bindings D1/R2
│   └── package.json
├── database/
│   ├── migrations/         # Migraciones SQL versionadas de D1
│   └── tests/              # Pruebas del modelo de datos (SQLite)
└── docs/                   # Documentación técnica
```

---

## 4. Responsabilidad de cada módulo

### Frontend

| Módulo | Responsabilidad |
| --- | --- |
| `css/` | Estilos, layout responsive, variables de diseño. |
| `js/api/` | Cliente `fetch` centralizado: URL base, cookies, cabeceras, manejo de respuestas/errores. |
| `js/components/` | Componentes de UI reutilizables e independientes de la vista. |
| `js/pages/` | Lógica específica de cada página/vista (carga de datos, render, eventos). |
| `js/utils/` | Funciones auxiliares del cliente (formato de precio, fechas, validación de UI). |
| `assets/images/` | Recursos estáticos locales. |

### Backend

| Módulo | Responsabilidad |
| --- | --- |
| `index.js` | Punto de entrada del Worker: enrutado, CORS, rate limiting y manejo de errores. |
| `router.js` | Enrutador HTTP mínimo sin dependencias (coincidencia de rutas + params). |
| `routes/` | Definición de endpoints públicos y privados (método + path -> controlador). |
| `controllers/` | Reciben la petición HTTP, validan parámetros, llaman servicios y devuelven respuestas. |
| `services/` | Lógica de negocio y mapeo a DTOs públicos (sin datos privados). |
| `repositories/` | Consultas SQL parametrizadas contra D1; selección explícita de columnas. |
| `middleware/` | Autenticación, CORS, rate limiting y manejo de errores. |
| `validators/` | Validación de parámetros de consulta (paginación, filtros, orden con lista blanca). |
| `utils/` | Respuestas JSON, errores HTTP y paginación. |

### Infraestructura

| Módulo | Responsabilidad |
| --- | --- |
| `database/migrations/` | Esquema SQL versionado aplicado a D1. |
| D1 | Persistencia relacional (usuarios, productos, transacciones, opiniones, mensajes...). |
| R2 | Almacenamiento de fotografías de productos. |

---

## 5. Modelo inicial de entidades y relaciones

Resumen (el esquema detallado está en [`DATABASE.md`](DATABASE.md)):

- **users** — cuentas de usuario (compradores y vendedores) y administradores.
- **sessions** — sesiones autenticadas (token hasheado + CSRF).
- **seller_profiles** — perfil público del vendedor (1—1 con `users`).
- **products** — productos publicados por un vendedor.
- **categories** — categorías (jerárquicas) para productos.
- **product_images** — fotografías de un producto (1—N con `products`; clave R2).
- **favorites** — productos guardados por un usuario (N—M).
- **conversations** — conversación entre comprador y vendedor sobre un producto.
- **messages** — mensajes dentro de una conversación.
- **transactions** — acuerdos entre comprador y vendedor sobre un producto.
- **seller_reviews** — calificación (1–5) + comentario, vinculada a una transacción completada.
- **reports** — reportes de contenido para moderación.

Relaciones principales:

- `users 1—1 seller_profiles`
- `seller_profiles 1—N products`
- `products 1—N product_images`
- `products 1—N conversations`
- `conversations 1—N messages`
- `products N—M users` (favoritos)
- `transactions N—1 products`, `N—1 users (buyer)`, `N—1 users (seller)`
- `seller_reviews N—1 transactions`, `N—1 users (reviewer)`, `N—1 users (reviewee)`

---

## 6. Flujo de autenticación

### Registro

1. El cliente envía `POST /api/auth/register` con `name`, `email` y `password`.
2. El backend valida los datos (formato de email, fortaleza mínima de contraseña).
3. Se genera una **salt** aleatoria y se deriva el hash de la contraseña (PBKDF2 vía Web Crypto; ver [`SECURITY.md`](SECURITY.md)).
4. Se inserta el usuario en D1 (consulta parametrizada). El email es único.
5. Se crea una sesión: token aleatorio (`crypto.getRandomValues`), se guarda el **hash** del token en D1 y se envía el token en una cookie `HttpOnly`, `Secure` y `SameSite`.
6. Se responde con el perfil del usuario (sin datos sensibles).

### Inicio de sesión

1. `POST /api/auth/login` con `email` y `password`.
2. Se busca el usuario por email y se verifica el hash de la contraseña (comparación en tiempo constante).
3. Se crea sesión y se establece la cookie, igual que en el registro.

### Cierre de sesión

1. `POST /api/auth/logout`.
2. Se elimina/invalida la sesión en D1 y se borra la cookie.

### Sesión y autorización

- La cookie `mp_session` contiene el token de sesión (aleatorio); el backend calcula su hash SHA-256 y lo busca en D1.
- El middleware `requireAuth(handler)` resuelve el usuario actual, lo adjunta al contexto (`ctx.auth`) y solo entonces invoca el handler. La identidad se deriva siempre de la sesión, nunca de un `user_id` enviado por el cliente.
- El middleware `requireCsrf(handler)` exige la cabecera `X-CSRF-Token` en operaciones de estado (`POST`/`PUT`/`PATCH`/`DELETE`).
- La autorización por permisos (por ejemplo, solo vendedores pueden publicar) se aplica en cada controlador.

---

## 7. Flujo de publicación de productos

1. Un usuario autenticado con perfil de vendedor envía `POST /api/products` (formulario multipart: título, descripción, precio, categoría, condición, ubicación y fotografías).
2. El backend valida:
   - Autenticación y permiso de vendedor.
   - Campos obligatorios, tipos y límites.
   - Archivos: tipo MIME permitido (JPEG/PNG/WebP), tamaño máximo 5 MB por imagen y máximo 8 imágenes por producto.
3. Por cada imagen válida, se sube a **R2** con una clave única (`products/{productId}/{uuid}.{ext}`) y se conserva la clave.
4. Se inserta el producto y sus imágenes en D1 (las claves R2, no los binarios).
5. Se responde con el producto creado y sus URLs/imágenes.

> El frontend nunca sube imágenes directamente a R2; siempre lo hace a través del backend.

---

## 8. Flujo de transacciones y calificación de vendedores

### Transacciones (confirmación bilateral y disputas)

1. Se registra el acuerdo entre comprador y vendedor sobre un producto (estado `pending`).
2. Cada parte confirma por separado (`buyer_confirmed_at` y `seller_confirmed_at`).
3. La transacción pasa a `completed` **únicamente** cuando **ambas partes** confirman. Una sola parte no puede completarla.
4. Antes de completar, una de las partes (o un administrador) puede:
   - **Cancelar** la transacción (`cancelled`).
   - **Abrir una disputa** (`disputed`), que luego se resuelve como `completed` o `cancelled`.
5. Una transacción `cancelled` o `disputed` nunca habilita calificación.

### Calificación de vendedores

1. Solo puede calificarse después de que una transacción esté en estado `completed` (completada y verificada por ambas partes).
2. El **comprador** envía `POST /api/reviews` con `transaction_id`, `rating` (1–5) y comentario opcional.
3. El backend valida:
   - El usuario está autenticado.
   - Es el comprador de esa transacción.
   - La transacción está completada.
   - No es el propio vendedor (`reviewer != reviewee`).
   - No existe ya una calificación del mismo comprador para esa transacción (restricción única).
   - `rating` está entre 1 y 5.
4. Se guarda la opinión y se recalcula la calificación promedio del vendedor (`average_rating` y `rating_count`).

---

## 9. Estrategia de almacenamiento en R2

- **Un bucket** (`marketperu-images`) para fotografías de productos.
- **Clave por objeto**: `products/{productId}/{uuid}.{ext}` — única, ordenable y sin colisiones.
- **Metadatos en D1**: la tabla `product_images` guarda la clave R2, la posición y si es la imagen principal.
- **Validación previa**: tipo MIME (JPEG/PNG/WebP), tamaño máximo y número máximo de imágenes por producto.
- **Lectura**: las imágenes públicas de productos se sirven mediante URLs de R2; las imágenes privadas (si las hubiera en el futuro) usarían URLs firmadas.
- El backend es el único que escribe en R2 (mediante el binding `IMAGES`).

---

## 10. Estrategia de despliegue en Cloudflare

### Componentes

- **Workers**: ejecuta el backend y sirve el frontend estático.
- **D1**: base de datos SQL (bindings `DB`).
- **R2**: almacenamiento de imágenes (binding `IMAGES`).

### Entornos

- `development` (local, `wrangler dev`).
- `staging` (preview).
- `production`.

### Despliegue

1. Aplicar migraciones D1 (`wrangler d1 execute ... --remote`).
2. Configurar secretos con `wrangler secret put` (nunca en `wrangler.toml` ni en Git).
3. Compilar/copiar el frontend estático si es necesario.
4. `wrangler deploy` para publicar el Worker.

### CI/CD (etapa posterior)

- Integración con GitHub Actions para ejecutar validaciones y desplegar.
- Las credenciales se almacenan como secretos de GitHub; nunca en el código.

> En la fase actual **no** se realiza ningún despliegue en producción y no se han inventado identificadores ni credenciales de Cloudflare.

---

## Decisiones

Resueltas en la Etapa 2 (base de datos):

- Moneda inicial: **PEN** (código ISO de 3 letras).
- Límites de imágenes: JPEG/PNG/WebP, máx. 5 MB por imagen, máx. 8 imágenes por producto.
- Transacciones con **confirmación bilateral** y estados de cancelación/disputa.
- **Frontend y backend se mantienen separados** en código y responsabilidades, aunque puedan desplegarse juntos en el mismo Worker.

Pendientes:

- Confirmar el dominio/URL público de producción.
- Decidir si el frontend se sirve desde el Worker (estáticos) o desde Cloudflare Pages en el futuro.
