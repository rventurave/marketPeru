# MarketPeru — Marketplace Web

Marketplace web inspirado en Facebook Marketplace, construido con JavaScript puro y la infraestructura de Cloudflare (Workers, D1 y R2).

## Estado actual

**Frontend público + autenticación implementados.**

El marketplace cuenta con un **frontend en JavaScript puro** (HTML5/CSS3/ES6+) que consume la API: catálogo con búsqueda y filtros, detalle de producto, perfiles de vendedor, calificaciones, registro e inicio de sesión. El **backend** (Cloudflare Workers + D1) expone la API REST y gestiona sesiones seguras. Mensajería, favoritos, publicaciones y transacciones se implementan en las siguientes etapas.

## Principios del producto

1. Cualquier visitante puede explorar productos, buscar, filtrar y consultar perfiles de vendedores **sin registrarse**.
2. Registrarse o iniciar sesión es **obligatorio** para contactar vendedores, enviar mensajes, guardar favoritos y realizar acciones personales.
3. Los vendedores tienen un perfil público con reputación de **1 a 5 estrellas**.
4. **No** hay pagos electrónicos en la primera versión: la transacción se coordina directamente entre comprador y vendedor.

## Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript (ES6+), Fetch API |
| Backend | JavaScript, Cloudflare Workers, API REST |
| Base de datos | Cloudflare D1 (SQL) |
| Imágenes | Cloudflare R2 |
| Despliegue | Wrangler CLI, Cloudflare Workers |
| Control de versiones | Git y GitHub |

Sin frameworks de frontend (sin React, Vue ni Angular). La primera versión usa JavaScript puro.

## Estructura del proyecto

```
marketPeru/
├── .gitignore
├── .env.example
├── README.md
├── docs/                     # Documentación técnica
│   ├── ARCHITECTURE.md
│   ├── BUSINESS_RULES.md
│   ├── DATABASE.md
│   ├── ROADMAP.md
│   └── SECURITY.md
├── frontend/                 # Presentación (JavaScript puro)
│   ├── index.html            # Catálogo y búsqueda
│   ├── product.html          # Detalle de producto
│   ├── seller.html           # Perfil público de vendedor
│   ├── login.html            # Inicio de sesión
│   ├── register.html         # Registro
│   ├── profile.html          # Perfil personal
│   ├── publish.html          # Publicar (interfaz; backend pendiente)
│   ├── dashboard.html        # Panel de usuario
│   ├── css/                  # Sistema de diseño (variables CSS)
│   ├── js/                   # api, auth, componentes y módulos
│   └── assets/               # Imágenes y recursos
├── backend/                  # API REST (Cloudflare Worker)
│   ├── package.json
│   ├── wrangler.toml
│   └── src/
│       ├── index.js          # Punto de entrada y enrutador
│       ├── routes/           # Definición de rutas REST
│       ├── controllers/      # Controladores HTTP
│       ├── services/         # Lógica de negocio
│       ├── middleware/       # Auth, validación, CSRF, rate limit...
│       ├── utils/            # Utilidades del servidor
│       └── config/           # Acceso a configuración/entorno
└── database/
    ├── migrations/           # Migraciones SQL de D1
    │   ├── 0001_initial_schema.sql
    │   ├── 0002_indexes.sql
    │   └── 0003_seed_categories.sql
    └── tests/                # Pruebas del modelo de datos
        └── database.test.mjs
```

La responsabilidad detallada de cada carpeta y módulo está en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — visión general, arquitectura, flujos y despliegue.
- [`docs/DATABASE.md`](docs/DATABASE.md) — modelo de entidades, relaciones y esquema.
- [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) — reglas de negocio obligatorias.
- [`docs/API.md`](docs/API.md) — referencia de la API REST.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — plan por etapas.
- [`docs/SECURITY.md`](docs/SECURITY.md) — estrategia de seguridad.

## Base de datos (D1)

El modelo relacional está en `database/migrations/`. Para ejecutar las migraciones localmente (D1/Wrangler):

```bash
cd backend
npm install
npm run db:migrate:local
```

Para correr las pruebas del modelo (SQLite, mismo motor que D1, sin credenciales):

```bash
cd backend
npm run test:db
```

Detalles del esquema, estados y flujos en [`docs/DATABASE.md`](docs/DATABASE.md).

## API (Cloudflare Worker)

El backend expone una API REST pública bajo `/api/` para explorar el marketplace sin registrarse:

- `GET /api/health`
- `GET /api/products` (búsqueda, filtros, orden y paginación)
- `GET /api/products/:id`
- `GET /api/categories` y `GET /api/categories/:id/products`
- `GET /api/sellers/:id` y `GET /api/sellers/:id/reviews`
- `GET /api/reviews/:id`

Autenticación (sesiones seguras con cookie `HttpOnly`):

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/users/me`

Las rutas privadas (publicar, mensajes, favoritos, transacciones, calificar) devuelven `401` sin sesión y `501` con sesión (aún no implementadas).

Para ejecutar las pruebas de la API (Vitest + Workers runtime):

```bash
cd backend
npm install
npm run test:api
```

Referencia completa en [`docs/API.md`](docs/API.md).

## Frontend (desarrollo)

El frontend son archivos estáticos (HTML/CSS/JS) servidos por separado del Worker.

1. Arranca el backend (Worker) en una terminal:

   ```bash
   cd backend
   npm install
   npm run dev        # http://localhost:8787
   ```

2. Sirve el frontend en otra terminal:

   ```bash
   cd frontend
   python3 -m http.server 8000
   ```

3. Abre `http://localhost:8000`.

El frontend llama a la API en `http://localhost:8787` (configurable en `frontend/js/config.js`). El origen `http://localhost:8000` ya está permitido en `ALLOWED_ORIGINS`.

## Configuración inicial

1. Clonar el repositorio e instalar la CLI:

   ```bash
   cd backend
   npm install
   ```

2. Copiar las variables de entorno de ejemplo y completarlas:

   ```bash
   cp .env.example .env
   ```

3. Crear los recursos en Cloudflare (en las siguientes etapas, cuando se vaya a implementar):

   ```bash
   npx wrangler d1 create marketperu
   npx wrangler r2 bucket create marketperu-images
   npx wrangler secret put SESSION_SECRET
   ```

   Los `id` devueltos se completan en `backend/wrangler.toml` (D1) y en `.env`.

> Nota: en esta fase **no** se han creado credenciales, identificadores ni secretos reales. Todos los valores son plantillas vacías.

## Reglas de seguridad básicas

- Las contraseñas nunca se almacenan en texto plano.
- Los secretos y variables privadas **no** se suben a GitHub (ver `.gitignore`).
- Toda operación sensible pasa por el backend; el frontend nunca accede directamente a D1 ni R2.
