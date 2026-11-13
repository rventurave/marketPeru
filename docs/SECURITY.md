# Seguridad — MarketPeru

Estrategia de seguridad definida desde el diseño. Todo punto listado aquí se aplicará en la implementación de backend.

---

## 1. Autenticación y contraseñas

- Las contraseñas **nunca** se almacenan en texto plano.
- **Algoritmo implementado:** PBKDF2-SHA256 vía Web Crypto (`crypto.subtle.importKey` + `deriveBits`).
  - Salt aleatoria de 16 bytes por contraseña.
  - 100 000 iteraciones.
  - Clave derivada de 256 bits (32 bytes).
  - Formato almacenado: `pbkdf2-sha256$<iterations>$<salt>$<hash>` (permite actualizar parámetros en el futuro).
- Comparación en tiempo constante (`timingSafeEqual`).
- El email es único y se normaliza (trim + minúsculas) y se valida su formato.
- La verificación de login usa mensajes genéricos para evitar enumeración de cuentas.

> Se eligió PBKDF2 por estar disponible de forma nativa en Workers (sin WebAssembly). Las iteraciones se almacenan en el hash, por lo que pueden subirse en el futuro (re-hash en el siguiente login). Para producción con alto volumen se recomienda el plan de pago de Workers (mayor límite de CPU) o ajustar iteraciones.

## 2. Sesiones

- Token de sesión aleatorio de 32 bytes generado con `crypto.getRandomValues`.
- En D1 se guarda **solo el hash SHA-256** del token; la cookie contiene el token original.
- `id` de sesión generado con `crypto.randomUUID()` (sin reutilización).
- Expiración: 30 días (`expires_at`); se valida en cada petición.
- Cookie `mp_session`:
  - `HttpOnly` (no accesible desde JavaScript).
  - `Secure` en producción.
  - `SameSite=Lax`.
  - `Path=/`.
  - `Max-Age=2592000`.
- El cierre de sesión revoca la sesión en D1 y borra la cookie (`Max-Age=0`).
- Las sesiones expiradas del usuario se limpian al iniciar sesión.
- No se usan `localStorage` ni `sessionStorage` para el token.

## 3. CSRF

- Token CSRF aleatorio por sesión (almacenado en `sessions.csrf_token`), devuelto en `/auth/me` y en login/registro.
- Se exige en la cabecera `X-CSRF-Token` para `POST`, `PUT`, `PATCH`, `DELETE` en rutas con sesión.
- Validación de `Origin` contra `ALLOWED_ORIGINS` en operaciones de estado (rechaza orígenes no permitidos).
- Doble protección: cookie `SameSite=Lax` + token CSRF + validación de origen.

## 4. SQL y persistencia

- **Solo consultas parametrizadas** (placeholders `?` de D1), nunca concatenación de SQL con entrada de usuario.
- Validación de toda entrada en el servidor (tipos, longitudes, formatos, rangos).

## 5. Autorización

- Los permisos se verifican **siempre en el backend**.
- Cada endpoint declara qué nivel de acceso requiere (visitante, autenticado, vendedor, admin).
- El frontend solo refleja permisos; nunca es la autoridad.

## 6. Archivos e imágenes (R2)

- Tipos permitidos: JPEG, PNG, WebP.
- Tamaño máximo por imagen: 5 MB.
- Número máximo de imágenes por producto: 8.
- Validación de MIME y contenido (no confiar solo en la extensión).
- Claves de objeto únicas y sin datos sensibles del usuario.
- El backend es el único que escribe en R2.

## 7. Protección contra spam y abuso

- Rate limiting en endpoints sensibles (registro, login, mensajes, reportes, calificaciones).
- Prevención de calificaciones duplicadas/fraudulentas (restricción única + transacción verificada).
- Moderación mediante reportes y administración.

## 8. Secretos y configuración

- Los secretos se configuran con `wrangler secret put` y **no** se escriben en `wrangler.toml` ni en código.
- `.env` y variables privadas están excluidas de Git (ver `.gitignore`).
- `.env.example` solo contiene plantillas vacías.
- Nunca se suben contraseñas, tokens privados ni credenciales a GitHub.

## 9. Cabeceras y transporte

- Forzar HTTPS en producción.
- Cabeceras de seguridad en las respuestas (por ejemplo, `X-Content-Type-Options: nosniff`).
- Política CORS restrictiva (solo orígenes permitidos).

## 10. Operación

- Revisar dependencias y mantenerlas actualizadas.
- Registrar errores sin exponer datos sensibles ni trazas de pila al cliente.
- Probar los flujos de seguridad antes de producción.

## 11. Auditoría de integridad (transacciones, calificaciones y operaciones privadas)

Puntos a verificar en la etapa de servicios (auth/transacciones/mensajería/favoritos):

1. **Confirmaciones de transacciones**: el paso a `completed` debe hacerse mediante una única actualización condicional en el backend que exija ambas confirmaciones (`buyer_confirmed_at` y `seller_confirmed_at`), además del trigger `trg_transactions_completed_guard`. No debe existir ninguna ruta que permita escribir `status` o las confirmaciones de forma arbitraria.

2. **Reputación al modificar/eliminar reseñas**: si se permiten `UPDATE`/`DELETE` de `seller_reviews`, el promedio y el contador deben recalcularse. La base de datos ya mantiene la reputación con triggers de `INSERT` y `DELETE`; una eventual edición de rating debe actualizarse en la misma transacción SQL o añadir el trigger de `UPDATE` correspondiente.

3. **Operaciones de conversaciones, imágenes y transacciones protegidas en el backend**: los triggers de la base de datos no sustituyen la autorización. Todas las rutas de mensajería, subida de imágenes (R2), favoritos y transacciones están detrás de `requireAuth()` en el backend, que rechaza peticiones anónimas con `401`. El backend es la única capa que valida permisos; nunca se confía en el cliente ni solo en la base de datos.
