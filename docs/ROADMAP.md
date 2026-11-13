# Roadmap — MarketPeru

Plan por etapas. Cada etapa construye sobre la anterior sin reorganizar la arquitectura.

---

## Etapa 1 — Fundación y arquitectura (completada)

Estado: **completada en esta fase**.

- [x] Inspección del repositorio.
- [x] Estructura de carpetas (`frontend/`, `backend/`, `database/`, `docs/`).
- [x] Documentación: arquitectura, base de datos, reglas de negocio, seguridad y roadmap.
- [x] Configuración inicial mínima: `.gitignore`, `.env.example`, `wrangler.toml`, `package.json`.
- [x] `git init`.

No incluye: código funcional, esquema SQL ejecutado, ni despliegues.

---

## Etapa 2 — Base de datos

Estado: **completada**.

- [x] Esquema relacional: `database/migrations/0001_initial_schema.sql` (tablas, FKs, CHECKs, triggers).
- [x] Índices: `database/migrations/0002_indexes.sql`.
- [x] Categorías iniciales: `database/migrations/0003_seed_categories.sql` (idempotente, 12 categorías).
- [x] Pruebas automatizadas: `database/tests/database.test.mjs` (integridad y flujos).
- [x] Moneda PEN, confirmación bilateral de transacciones y manejo de disputas.

---

## Etapa 3 — Backend base y autenticación

Estado: **completada**.

Hecho:

- [x] Punto de entrada `backend/src/index.js` y enrutador (`router.js`).
- [x] Repositorios, servicios, controladores y validadores.
- [x] Endpoints públicos: health, productos, categorías, vendedores y opiniones.
- [x] Middleware de CORS, rate limiting, errores y autorización (`requireAuth`).
- [x] Autenticación completa: registro, login, logout, `/auth/me`, `PATCH /users/me`.
- [x] Hashing PBKDF2-SHA256, sesiones con cookie `HttpOnly` y protección CSRF.
- [x] Pruebas de integración (API + autenticación) con Vitest + Workers.

Pendiente (etapas siguientes):

- Implementación de operaciones privadas (publicar, mensajes, favoritos, transacciones, calificar).
- Creación explícita del perfil de vendedor (al publicar productos).

---

## Etapa 4 — Productos e imágenes (R2)

- CRUD de productos y categorías.
- Subida/validación de imágenes a R2.
- Búsqueda y filtros.
- Estados de publicación.

---

## Etapa 5 — Vendedores y reputación

- Perfiles públicos de vendedores.
- Historial de opiniones y calificación promedio.
- Transacciones y confirmación de ambas partes.
- Calificaciones vinculadas a transacciones (1–5, anti-duplicados).

---

## Etapa 6 — Mensajería y favoritos

- Conversaciones y mensajes entre compradores y vendedores.
- Favoritos (guardar/eliminar/consultar).

---

## Etapa 7 — Frontend

Estado: **completada** (navegación pública + autenticación).

- [x] Sistema de diseño con variables CSS, componentes y responsive.
- [x] Páginas: catálogo, producto, vendedor, login, registro, perfil, publicar (visual) y panel.
- [x] Cliente Fetch centralizado (`js/api.js`), auth, navegación y componentes reutilizables.
- [x] Integración con la API pública y de autenticación (incluye CSRF y cookie de sesión).
- [x] Búsqueda con debounce, filtros combinables, paginación y estados de interfaz.

Pendiente: conectar mensajería, favoritos y publicación cuando el backend correspondiente esté listo.

---

## Etapa 8 — Administración, moderación y calidad

- Panel de administración: usuarios, moderación de productos, reportes.
- Pruebas, hardening de seguridad y revisión de [`SECURITY.md`](SECURITY.md).
- Preparación para producción.

---

## Etapa 9 — Despliegue y CI/CD

- Configuración de entornos (`development`, `staging`, `production`).
- Migraciones remotas y secretos (`wrangler secret put`).
- GitHub Actions para validar y desplegar.

---

## Decisiones

Resueltas en la Etapa 2:

- Moneda inicial: **PEN** (código ISO).
- Límites de imágenes: JPEG/PNG/WebP, máx. 5 MB, máx. 8 por producto.
- Confirmación bilateral de transacciones + estados de cancelación/disputa.

Pendientes:

- Dominio/URL de producción.
- Estrategia de servido del frontend (desde Worker vs. Cloudflare Pages).
