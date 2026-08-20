# Documentación técnica

## 1. Resumen del sistema

Tasker es una aplicación full stack orientada a un equipo pequeño de administración de consorcios. El navegador renderiza la interfaz React, las rutas del servidor validan la sesión y las reglas de permisos, y Cloudflare D1 conserva los datos.

## 2. Arquitectura

Flujo general:

```text
Navegador
  -> páginas y componentes React/Vinext
  -> rutas API del servidor
  -> servicios de autenticación y tareas
  -> enlace DB
  -> Cloudflare D1 (SQLite)
```

### Componentes

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Interfaz | React 19, TypeScript | Tablero, formularios, modales, filtros y comentarios. |
| Framework | Vinext y Vite | Enrutamiento, renderizado y compilación. |
| Servidor | Cloudflare Worker | Atiende páginas y rutas API. |
| Persistencia | Cloudflare D1 | Guarda usuarios, sesiones, consorcios, tareas y comentarios. |
| Esquema | Drizzle ORM | Define tablas, índices y migraciones. |
| Alojamiento | OpenAI Sites | Publicación, URL y enlace de recursos. |

## 3. Estructura del repositorio

```text
app/
  api/                 Rutas de autenticación, usuarios, consorcios y tareas
  login/               Pantalla de ingreso
  TaskApp.tsx          Interfaz principal y estado del cliente
  UserImport.tsx       Lectura de Excel y CSV
db/
  auth-store.ts        Inicio de sesión, sesiones y perfiles
  database.ts          Inicialización y acceso a D1
  schema.ts            Esquema Drizzle
  task-store.ts        Reglas de tareas, comentarios y consorcios
drizzle/               Migraciones SQL versionadas
lib/current-user.ts    Resolución de la identidad actual
worker/index.ts        Entrada del Cloudflare Worker
.openai/hosting.json   Enlaces lógicos de Sites
docs/                  Documentación del proyecto
```

## 4. Autenticación y sesiones

Tasker utiliza autenticación propia, independiente del inicio de sesión de ChatGPT.

### Flujo de ingreso

1. El navegador envía usuario y contraseña a `POST /api/auth/login`.
2. El servidor busca el usuario activo sin distinguir mayúsculas.
3. Verifica la contraseña mediante PBKDF2 con SHA-256 y 100.000 iteraciones.
4. Genera un token aleatorio.
5. Guarda en `sessions` únicamente el resumen SHA-256 del token.
6. Envía el token al navegador en la cookie `tasker_session`.

### Cookie de sesión

- Duración: 30 días.
- `HttpOnly`: no es accesible desde JavaScript del navegador.
- `SameSite=Lax`.
- `Secure` en HTTPS.
- Ruta `/`.

Cerrar sesión elimina la fila correspondiente de `sessions` y vence la cookie.

### Contraseñas

La base de datos guarda resumen, sal e iteraciones, no la contraseña legible. Sin embargo, la importación desde Excel requiere contraseñas legibles dentro del archivo. Por eso la seguridad efectiva depende también del control de acceso a ese Excel.

## 5. Autorización

Las validaciones importantes se ejecutan en el servidor; ocultar un botón en la interfaz no es la única protección.

| Acción | Usuario común | Administrador |
|---|---:|---:|
| Crear una tarea | Sí | Sí |
| Ver una tarea creada por sí mismo | Sí | Sí |
| Ver una tarea asignada a sí mismo | Sí | Sí |
| Ver cualquier tarea privada | No | No |
| Cambiar estado de una tarea visible | Sí | Sí |
| Cambiar prioridad, asignado o consorcio | Solo creador | Solo creador |
| Comentar una tarea visible | Sí | Sí |
| Eliminar una tarea | Solo creador | Si la tiene visible |
| Ver equipo y consorcios | Sí | Sí |
| Administrar consorcios | No | Sí |
| Importar o editar usuarios | No | Sí |
| Dar de baja usuarios | No | Sí |

## 6. Privacidad de tareas

La consulta principal recupera una tarea únicamente cuando:

```text
creator_id = usuario_actual OR assignee_id = usuario_actual
```

No existe una excepción global para el administrador. Esta regla es intencional y coincide con el mensaje de privacidad de la interfaz.

## 7. Reglas funcionales del servidor

### Tareas

- El título es obligatorio.
- Prioridades admitidas: `low`, `medium`, `high`.
- Estados admitidos: `pending`, `in_progress`, `review`, `done`.
- El asignado debe ser un usuario activo.
- El consorcio debe existir cuando se indica un identificador.
- Creador y asignado pueden actualizar el estado.
- Solo el creador puede cambiar otros campos.
- Al borrar la tarea, SQLite elimina sus comentarios por cascada.

### Comentarios

- El texto no puede estar vacío.
- Solo pueden comentar creador y asignado.
- Un comentario actualiza la fecha de modificación de la tarea.

### Consorcios

- El nombre es obligatorio y único.
- Solo un administrador puede crear, editar o eliminar.
- Renombrar un consorcio actualiza el texto `building` de sus tareas.
- Eliminarlo desvincula las tareas, pero conserva el texto histórico del edificio.

### Usuarios

- Usuario y nombre son obligatorios.
- El nombre de usuario debe ser único.
- Solo un administrador puede editar o dar de baja.
- No se puede dar de baja el usuario de la propia sesión.
- Debe quedar al menos un administrador activo.
- La baja elimina sesiones y cambia el estado a `invited`; no borra la fila.

## 8. Inicialización de la base

`ensureDatabase()` crea las tablas e índices si no existen, agrega columnas faltantes de versiones anteriores, limpia sesiones vencidas y ejecuta `PRAGMA optimize`.

También migra nombres históricos de edificios: si una tarea antigua contiene un nombre en `building` sin `consortium_id`, crea o reutiliza el consorcio correspondiente y vincula la tarea.

## 9. Administrador de arranque

Si la base no contiene un administrador activo, la aplicación crea el perfil inicial `admin`. El mecanismo también corrige hashes incompatibles con el límite de PBKDF2 de la plataforma.

## 10. Variables y recursos

`.openai/hosting.json` declara:

- D1: `DB`.
- R2: no utilizado.

No hay claves externas ni servicios de correo, mensajería o almacenamiento de archivos en la versión actual.

## 11. Compilación y comandos

| Comando | Uso |
|---|---|
| `npm install` | Instala dependencias. |
| `npm run dev` | Inicia el entorno local. |
| `npm run build` | Genera la compilación de producción. |
| `npm run lint` | Ejecuta ESLint. |
| `npm run db:generate` | Genera una migración Drizzle después de cambiar el esquema. |

Node.js debe ser 22.13 o posterior.

## 12. Publicación

El código vive en GitHub y la aplicación productiva está publicada mediante OpenAI Sites. Sites enlaza el Worker con la base D1 productiva.

GitHub conserva código, migraciones y documentación. No contiene los registros de producción.

## 13. Pruebas

La validación práctica usada en el mantenimiento incluye:

- Compilación completa.
- Pruebas de inicio de sesión.
- Creación, asignación, modificación y eliminación por API.
- Comprobaciones de permisos entre administrador y usuario común.

El archivo `tests/rendered-html.test.mjs` proviene del starter original y todavía verifica una pantalla de carga que ya no representa Tasker. Debe considerarse deuda técnica y no cobertura funcional válida hasta ser reemplazado.

## 14. Limitaciones conocidas

- No hay recuperación de contraseña por correo.
- No hay doble factor de autenticación.
- No hay bloqueo por intentos fallidos.
- No hay avisos por correo, SMS, WhatsApp ni push.
- No hay adjuntos.
- No hay papelera para tareas.
- No hay exportación completa desde la interfaz.
- No hay registro de auditoría separado de los comentarios.
- El administrador no dispone de una vista global de tareas privadas.
- La interfaz no permite editar título, descripción ni vencimiento después de crear la tarea.
- Las pruebas automatizadas del starter deben actualizarse.

## 15. Extensiones futuras posibles

- Centro de notificaciones internas.
- Correos opcionales por asignación o comentario.
- Exportación CSV/Excel de tareas y consorcios.
- Copias de seguridad administrables.
- Adjuntos en R2.
- Auditoría de cambios.
- Papelera con restauración.
- Edición completa de tareas.
