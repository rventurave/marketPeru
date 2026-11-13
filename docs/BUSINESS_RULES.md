# Reglas de negocio — MarketPeru

Reglas obligatorias que toda la plataforma debe cumplir. Son la fuente de verdad para validaciones de backend y permisos.

---

## 1. Reglas fundamentales

1. **No se requiere registro para explorar el marketplace.**
2. **Los visitantes pueden consultar productos y perfiles de vendedores.**
3. **Solo usuarios autenticados pueden contactar vendedores.**
4. **Solo vendedores autenticados pueden publicar productos.**
5. **Los vendedores no pueden calificarse a sí mismos.**
6. **Las calificaciones deben estar vinculadas a transacciones verificadas.**
7. **Un comprador solo puede emitir una calificación por transacción.**
8. **Las calificaciones deben estar entre 1 y 5.**
9. **Las fotografías se almacenan en R2 y sus identificadores en D1.**
10. **Los permisos se verifican siempre en el backend.**
11. **No se implementan pagos electrónicos en la primera versión.**

---

## 2. Reglas por módulo

### Usuarios y autenticación

- El registro requiere `name`, `email` y `password`.
- El `email` es único y se normaliza (trim + minúsculas).
- La contraseña se almacena **solo como hash** (PBKDF2-SHA256, nunca texto plano).
- El cierre de sesión invalida la sesión actual.
- Un usuario puede ser comprador y vendedor a la vez.
- El rol de administrador es independiente del perfil de vendedor y **no** puede auto-asignarse en el registro.
- El login no revela si un correo existe (mensajes de error genéricos).
- Las sesiones usan cookie `HttpOnly` + token CSRF; la identidad siempre se deriva de la sesión, nunca de datos enviados por el frontend.

### Productos

- Solo usuarios autenticados con perfil de vendedor pueden crear, editar o eliminar productos.
- Un vendedor solo puede modificar **sus propios** productos.
- Un producto tiene un estado: `active`, `sold`, `hidden`, `removed`.
- La moneda inicial es **PEN** (código ISO), almacenada como código de 3 letras mayúsculas.
- Cada producto puede tener una o más fotografías.
- Las imágenes van a R2; en D1 solo se guarda la clave (`r2_key`).

Límites de imágenes (validados en el backend):

| Regla | Valor |
| --- | --- |
| Formatos permitidos | JPEG, PNG, WebP |
| Tamaño máximo por imagen | 5 MB |
| Máximo de imágenes por producto | 8 |

### Vendedores

- El perfil del vendedor es **público** (visible para visitantes).
- El perfil muestra: información, productos publicados, calificación promedio e historial de opiniones.
- La calificación promedio se recalcula al agregar cada opinión válida.

### Reputación

- Las calificaciones son de 1 a 5 estrellas.
- Una opinión incluye calificación y comentario (opcional).
- Solo puede calificar el **comprador** de una transacción **completada y verificada** (ambas partes confirmaron).
- Un comprador no puede calificar dos veces la misma transacción.
- Un vendedor no puede calificarse a sí mismo.
- Se deben prevenir calificaciones duplicadas y fraudulentas (restricción única + verificación de transacción).

### Mensajería

- Solo usuarios autenticados pueden iniciar/participar en conversaciones.
- Una conversación pertenece a un comprador, un vendedor y un producto.
- Los mensajes pertenecen a una conversación y tienen un remitente autenticado.
- El acceso a una conversación se limita a sus participantes (y administradores).

### Favoritos

- Solo usuarios autenticados pueden guardar/eliminar favoritos.
- Un producto no puede guardarse dos veces por el mismo usuario.
- Los favoritos son privados del usuario.

### Transacciones

- Una transacción vincula comprador, vendedor y producto.
- Estados: `pending`, `completed`, `cancelled`, `disputed`.
- Una transacción **no** puede completarse porque una sola parte lo indique.
- La transacción pasa a `completed` únicamente cuando **ambas partes** confirman (confirmación bilateral).
- Solo una transacción `completed` habilita la calificación.
- Una transacción `cancelled` o `disputed` **nunca** habilita calificación.

Flujo de confirmación bilateral y disputas:

```
pending ── confirmación de comprador + vendedor ──> completed
   │
   ├── una parte cancela (antes de completar) ──> cancelled
   └── se abre disputa (antes de completar) ────> disputed
                                                   └── resolución -> completed | cancelled
```

- La cancelación la puede iniciar cualquiera de las partes (o un administrador) antes de completar.
- Una disputa se abre antes de completar; su resolución puede cerrarla como `completed` o `cancelled`.
- La orquestación de estos cambios de estado se realiza en el backend con actualizaciones condicionales.

### Administración

- Los administradores (`role = 'admin'`) gestionan usuarios, moderan productos y revisan reportes.
- Los reportes tienen estados: `pending`, `reviewed`, `resolved`, `dismissed`.

---

## 3. Matriz de permisos

| Acción | Visitante | Usuario autenticado | Vendedor | Admin |
| --- | --- | --- | --- | --- |
| Explorar productos | Sí | Sí | Sí | Sí |
| Ver perfil de vendedor | Sí | Sí | Sí | Sí |
| Buscar / filtrar | Sí | Sí | Sí | Sí |
| Contactar vendedor / mensajes | No | Sí | Sí | Sí |
| Guardar favoritos | No | Sí | Sí | Sí |
| Publicar / editar producto | No | No | Sí (propio) | Sí |
| Calificar vendedor | No | Sí (tras transacción) | — | — |
| Moderar contenido | No | No | No | Sí |

> Los permisos se aplican siempre en el **backend**, nunca se confía en el frontend.

---

## 4. Restricciones de la primera versión

- Sin pagos electrónicos (sin pasarelas, sin cobros).
- La comunicación y coordinación de la transacción es entre comprador y vendedor.
- Sin frameworks de frontend (JavaScript puro).
