# Referencia de API y modelo de datos

## 1. Convenciones

- Todas las rutas dinámicas se ejecutan en el servidor.
- Las rutas protegidas obtienen la identidad desde la cookie de sesión.
- Las respuestas correctas devuelven JSON.
- Los errores de autenticación usan normalmente HTTP 401.
- Los errores de validación o permiso usan normalmente HTTP 400.
- Las operaciones de trabajo devuelven el espacio completo actualizado: usuario actual, usuarios activos, consorcios y tareas visibles.

## 2. Endpoints

| Método | Ruta | Descripción | Permiso |
|---|---|---|---|
| POST | `/api/auth/login` | Inicia sesión. | Público. |
| POST | `/api/auth/logout` | Cierra la sesión actual. | Sesión opcional. |
| POST | `/api/tasks` | Crea una tarea. | Usuario activo. |
| PATCH | `/api/tasks/:id` | Actualiza una tarea. | Creador o asignado según campo. |
| DELETE | `/api/tasks/:id` | Elimina una tarea. | Creador o administrador con tarea visible. |
| POST | `/api/tasks/:id/comments` | Agrega un comentario. | Creador o asignado. |
| POST | `/api/consorcios` | Crea un consorcio. | Administrador. |
| PATCH | `/api/consorcios/:id` | Actualiza un consorcio. | Administrador. |
| DELETE | `/api/consorcios/:id` | Elimina un consorcio. | Administrador. |
| POST | `/api/users/import` | Importa usuarios. | Administrador. |
| PATCH | `/api/users/:id` | Edita un perfil. | Administrador. |
| DELETE | `/api/users/:id` | Da de baja un perfil. | Administrador. |
| POST | `/api/intake/events` | Recibe un mensaje normalizado y deduplicado. | Clave del demonio. |
| POST | `/api/daemon/heartbeat` | Registra estado de PC y fuentes. | Clave del demonio. |
| POST | `/api/intake/test` | Simula un ingreso automático. | Administrador. |
| PATCH | `/api/intake/:id` | Confirma o descarta un ingreso. | Administrador. |

## 3. Cuerpos principales

### Iniciar sesión

```json
{
  "username": "admin",
  "password": "admin123"
}
```

### Crear tarea

```json
{
  "title": "Coordinar reparación del ascensor",
  "description": "Solicitar fecha y presupuesto",
  "consortiumId": "uuid-o-null",
  "priority": "high",
  "status": "pending",
  "dueDate": "2026-08-31",
  "assigneeId": "uuid-o-null"
}
```

### Actualizar tarea

```json
{
  "status": "in_progress",
  "priority": "medium",
  "assigneeId": "uuid-o-null",
  "consortiumId": "uuid-o-null"
}
```

El servidor ignora para el asignado los campos reservados al creador.

### Agregar comentario

```json
{
  "body": "El proveedor confirmó visita para el viernes."
}
```

### Crear o editar consorcio

```json
{
  "name": "Consorcio Cabildo 1842",
  "address": "Av. Cabildo 1842",
  "notes": "Encargado por la mañana"
}
```

### Editar perfil

```json
{
  "username": "laura",
  "name": "Laura Martín",
  "role": "member",
  "password": ""
}
```

Una contraseña vacía conserva la contraseña actual.

### Importar usuarios

```json
{
  "users": [
    {
      "username": "laura",
      "name": "Laura Martín",
      "password": "laura123",
      "role": "usuario"
    }
  ]
}
```

## 4. Modelo relacional

```text
users 1 ----- N sessions
users 1 ----- N tasks (creator_id)
users 1 ----- N tasks (assignee_id, opcional)
users 1 ----- N comments
consorcios 1 ----- N tasks (consortium_id, opcional)
tasks 1 ----- N comments
tasks 1 ----- N automatic_intake
daemon_instances 1 ----- N daemon_sources
```

## 5. Tabla `users`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | TEXT | UUID, clave primaria. |
| `auth_user_id` | TEXT | Campo heredado, único y opcional. |
| `username` | TEXT | Nombre de ingreso, único. |
| `email` | TEXT | Único; actualmente es interno para usuarios importados. |
| `name` | TEXT | Nombre visible. |
| `role` | TEXT | `admin` o `member`. |
| `status` | TEXT | `active` o `invited`. |
| `password_hash` | TEXT | Resumen PBKDF2. |
| `password_salt` | TEXT | Sal hexadecimal. |
| `password_iterations` | INTEGER | Actualmente 100.000. |
| `created_at` | INTEGER | Milisegundos Unix. |
| `last_seen_at` | INTEGER | Última actividad conocida. |

Índices únicos: `auth_user_id`, `username` y `email`.

## 6. Tabla `sessions`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | TEXT | SHA-256 del token, clave primaria. |
| `user_id` | TEXT | Usuario propietario. |
| `created_at` | INTEGER | Creación. |
| `expires_at` | INTEGER | Vencimiento. |

Las sesiones vencidas se limpian durante la inicialización. Al dar de baja un usuario se eliminan todas sus sesiones.

## 7. Tabla `consorcios`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | TEXT | UUID, clave primaria. |
| `name` | TEXT | Obligatorio y único. |
| `address` | TEXT | Dirección, admite vacío. |
| `notes` | TEXT | Notas internas, admite vacío. |
| `created_at` | INTEGER | Creación. |
| `updated_at` | INTEGER | Última modificación. |

## 8. Tabla `tasks`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | TEXT | UUID, clave primaria. |
| `title` | TEXT | Obligatorio. |
| `description` | TEXT | Admite vacío. |
| `building` | TEXT | Copia histórica del nombre del consorcio. |
| `priority` | TEXT | `low`, `medium`, `high`. |
| `status` | TEXT | `pending`, `in_progress`, `review`, `done`. |
| `due_date` | TEXT | Fecha `AAAA-MM-DD` o nulo. |
| `consortium_id` | TEXT | Consorcio o nulo. |
| `creator_id` | TEXT | Creador obligatorio. |
| `assignee_id` | TEXT | Asignado opcional. |
| `created_at` | INTEGER | Creación. |
| `updated_at` | INTEGER | Última modificación o comentario. |

Índices principales:

- `(creator_id, status)`
- `(assignee_id, status)`
- `consortium_id`

## 9. Tabla `comments`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | TEXT | UUID, clave primaria. |
| `task_id` | TEXT | Tarea obligatoria. |
| `author_id` | TEXT | Autor obligatorio. |
| `source` | TEXT | `manual`, `email`, `whatsapp` o `system`. |
| `external_author` | TEXT | Nombre o dirección del remitente externo. |
| `body` | TEXT | Texto obligatorio. |
| `created_at` | INTEGER | Fecha y hora. |

Índice principal: `(task_id, created_at)`.

## 10. Tablas de automatización

- `automatic_intake` conserva el identificador externo, conversación, remitente, cuerpo limpio, clasificación, consorcio, tarea y estado de revisión.
- La combinación de origen, cuenta e identificador externo evita reprocesar el mismo evento.
- `daemon_instances` conserva computadora, versión, inicio y última señal.
- `daemon_sources` conserva tipo, cuenta, conexión, último control, último mensaje y error.

## 11. Reglas de eliminación

| Elemento eliminado | Efecto |
|---|---|
| Tarea | Borra comentarios por cascada. |
| Consorcio | La aplicación pone `consortium_id` en nulo y conserva `building`. |
| Perfil desde la página | No borra la fila; cambia a `invited` y elimina sesiones. |
| Usuario mediante SQL físico | El esquema podría borrar tareas creadas y comentarios por cascada; no debe hacerse sin respaldo. |

## 12. Forma de respuesta `WorkspaceData`

```text
currentUser   Perfil autenticado
users         Usuarios activos
consorcios    Catálogo completo
tasks         Tareas visibles para currentUser, con comentarios
intakeItems   Ingresos automáticos visibles para administradores
daemons       Computadoras y fuentes visibles para administradores
```

Cada operación exitosa devuelve este conjunto actualizado para que la interfaz reemplace su estado sin recargar toda la página.
