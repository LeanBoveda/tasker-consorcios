# Operación, mantenimiento y datos

## 1. Entornos

### Producción

- URL: <https://tasker-consorcios.cuentagpt050.chatgpt.site>
- Alojamiento: OpenAI Sites.
- Estado: activo.
- Acceso al sitio: público por URL, seguido por el inicio de sesión propio de Tasker.
- Base: Cloudflare D1 enlazada como `DB`.

### Código fuente

- Repositorio: <https://github.com/LeanBoveda/tasker-consorcios>
- Rama de trabajo publicada: `master`.

### Desarrollo local

La configuración de Vite usa Wrangler/Miniflare para simular el enlace D1. El estado local y los registros productivos son independientes.

## 2. Dónde están los datos

Los datos productivos no se guardan en GitHub, Excel ni dentro de los archivos del proyecto. Se encuentran en la base Cloudflare D1 administrada por Sites.

Tablas verificadas en producción:

- `users`
- `sessions`
- `consorcios`
- `tasks`
- `comments`

El Excel sirve para importar credenciales; no es la base de datos principal.

## 3. Ver la base de datos

La forma recomendada de consultar producción es abrir el proyecto Tasker en Sites y entrar a la sección de configuración o visor de base de datos. Seleccionar el enlace `DB` y luego la tabla deseada.

Usos habituales:

- `users`: revisar usuarios activos o dados de baja.
- `tasks`: consultar tareas y relaciones.
- `comments`: revisar comentarios por tarea.
- `consorcios`: revisar el catálogo.
- `sessions`: diagnosticar sesiones; normalmente no debe editarse manualmente.

## 4. Manipulación manual

Siempre debe preferirse la interfaz de Tasker. Una edición directa puede saltear validaciones y dejar datos inconsistentes.

Antes de modificar producción:

1. Identificar exactamente la tabla y el registro.
2. Registrar el valor anterior.
3. Confirmar identificadores y relaciones.
4. Cambiar un registro por vez.
5. Probar la aplicación después del cambio.

### Valores admitidos

- `users.role`: `admin` o `member`.
- `users.status`: `active` o `invited`.
- `tasks.priority`: `low`, `medium` o `high`.
- `tasks.status`: `pending`, `in_progress`, `review` o `done`.
- Fechas internas: milisegundos Unix, excepto `due_date`, que usa `AAAA-MM-DD`.

No se debe cambiar manualmente `password_hash`, `password_salt`, `sessions.id` ni identificadores UUID salvo que se conozca completamente el impacto.

## 5. Copias de seguridad

La protección se divide en dos partes.

### Código y documentación

GitHub conserva:

- Código fuente.
- Historial de cambios.
- Migraciones.
- Documentación.

Comprobar con frecuencia que la rama local y `origin/master` estén sincronizadas.

### Datos de producción

GitHub no guarda tareas, usuarios, comentarios ni consorcios productivos.

La versión actual no tiene un botón de exportación completa. Antes de una operación riesgosa se recomienda obtener una exportación desde las herramientas de Sites/D1 cuando esté disponible o solicitar que se implemente una exportación administrada.

### Información especialmente sensible a una eliminación

- Eliminar una tarea borra también todos sus comentarios.
- Eliminar un perfil desde la página conserva tareas y comentarios.
- Eliminar un consorcio conserva el nombre histórico en las tareas.

## 6. Recuperación

### Recuperar código

Git permite volver a una versión anterior del código usando el historial del repositorio. La reversión debe compilarse, publicarse y verificarse.

### Recuperar un usuario dado de baja

Volver a importar el mismo nombre de usuario desde Excel o CSV. Esto reactiva el perfil y reemplaza nombre, rol y contraseña.

### Recuperar una tarea eliminada

No existe recuperación desde la aplicación. Solo sería posible mediante una copia de seguridad previa de la base.

## 7. Procedimiento de publicación

Para un cambio funcional:

1. Revisar que el árbol de trabajo no contenga cambios ajenos.
2. Implementar el cambio.
3. Compilar con `npm run build`.
4. Ejecutar pruebas específicas del flujo modificado.
5. Crear un commit descriptivo.
6. Subir a GitHub.
7. Publicar la misma revisión en Sites.
8. Confirmar el estado satisfactorio de la publicación.
9. Probar ingreso y acción principal.

La revisión publicada en Sites debe coincidir con la revisión guardada en GitHub.

## 8. ¿Puede alojarse en Vercel?

No funcionaría de manera idéntica con solo importar el repositorio. El código usa:

- `cloudflare:workers`.
- Un Cloudflare Worker como entrada.
- Cloudflare D1 enlazado como `DB`.
- La integración de Sites para publicación.

Para migrar a Vercel habría que reemplazar o adaptar la base de datos, el acceso al entorno Worker y el procedimiento de despliegue. Mientras se mantenga la arquitectura actual, Sites es el alojamiento más directo.

## 9. Mantenimiento del esquema

Cuando cambie `db/schema.ts`:

1. Actualizar también la inicialización compatible en `db/database.ts`.
2. Ejecutar `npm run db:generate`.
3. Revisar el SQL generado en `drizzle/`.
4. Verificar claves foráneas, índices y datos existentes.
5. Compilar y probar sobre una base local.
6. Publicar con la migración incluida.

No se deben borrar migraciones ya aplicadas en producción.

## 10. Solución de problemas

### Error de PBKDF2 por más de 100.000 iteraciones

La plataforma actual admite hasta 100.000 iteraciones. Tasker usa ese valor. Si un usuario antiguo conserva un valor mayor, volver a importarlo desde Excel o editar su contraseña desde un administrador.

### El administrador inicial no ingresa

Probar `admin` y `admin123` únicamente si nunca se modificó el perfil. Si fue cambiado, usar las credenciales actuales o reimportar un administrador existente.

### Una tarea desapareció

Revisar filtros y búsqueda. Confirmar que el usuario siga siendo creador o asignado. Los administradores no tienen vista global.

### Un usuario eliminado debe volver

Importar otra vez el mismo usuario. La importación cambia su estado a activo.

### Un consorcio eliminado sigue escrito en una tarea

Es el comportamiento esperado: se conserva el texto histórico aunque ya no exista el vínculo con el catálogo.

### La base local está vacía

La base local no comparte registros con producción. Es un entorno separado.

## 11. Lista de control mensual

- Confirmar que la página abre y permite iniciar sesión.
- Revisar usuarios y administradores activos.
- Revisar consorcios duplicados o desactualizados.
- Comprobar que los cambios recientes estén en GitHub.
- Revisar eliminaciones de tareas antes de ejecutarlas.
- Preparar una exportación de datos antes de cambios estructurales.
- Actualizar la documentación cuando cambie el comportamiento.
