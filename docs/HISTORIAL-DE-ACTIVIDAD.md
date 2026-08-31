# Historial de actividad

En **Actividad**, los administradores pueden consultar las acciones realizadas en
su espacio. El perfil de prueba y la administración real mantienen historiales
separados. La identidad se obtiene de la sesión, nunca del cuerpo de una petición.

Cada registro guarda fecha y hora del servidor, usuario y nombre del autor en ese
momento, acción, identificador y nombre del elemento afectado y detalles explícitos.
La interfaz muestra horarios de Buenos Aires, búsqueda por elemento o persona,
filtros por autor y tipo, y páginas de 50 registros con «Cargar registros anteriores».
La búsqueda por nombre permite localizar también autores eliminados del equipo.

## Acciones registradas

- Inicio de sesión correcto y cierre de sesión explícito.
- Creación, edición, asignación, cambio de estado y eliminación de tareas.
- Comentarios agregados a tareas.
- Creación, edición y eliminación de consorcios.
- Creación y actualización de usuarios desde Excel, cambios de nombre, usuario,
  permisos o contraseña, y eliminación/desactivación de perfiles.
- Simulación, confirmación y descarte de ingresos, indicando el efecto sobre la tarea.
- Ingresos y seguimientos del demonio, atribuidos a **Demonio**, no a una persona.
- Limpieza operativa, con cantidades de tareas, comentarios e ingresos eliminados.

Una edición guarda los valores anteriores y nuevos de los campos modificados.
Las descripciones y comentarios extensos se resumen a 500 caracteres por valor.
Una solicitud sin cambios, rechazada o repetida por el demonio no genera una acción
exitosa ficticia. No se registran clics, lecturas de pantalla, búsquedas, inicios
fallidos, expiración automática de sesiones ni señales periódicas del demonio.

## Persistencia e integridad

La tabla D1 `activity_log` se crea con la migración `0013`. No tiene claves foráneas
hacia usuarios o tareas: su historial no se borra ni se renombra al modificar esos
elementos. La limpieza operativa tampoco borra los registros. No hay endpoints ni
botones para editar o eliminar actividad. El acceso directo a D1 sigue siendo un
privilegio del propietario de la base; esto no es un registro externo inviolable.

La operación y su registro se escriben en el mismo lote transaccional de D1. Si no
se puede guardar la actividad, la operación no se confirma. La lectura de actividad
está protegida en el servidor por usuario activo, rol administrador y espacio.
La paginación usa fecha e identificador para no repetir ni saltar entradas anteriores
si llegan nuevas acciones mientras se consulta el historial.

No se guardan contraseñas, hashes, tokens de sesión ni claves de integración.
Los cambios de contraseña solo indican que se actualizó. Los detalles se construyen
con campos permitidos, sin serializar peticiones ni registros de autenticación.

El registro comienza al publicar esta función; no inventa actividad histórica.
Identifica la **cuenta utilizada**, no verifica físicamente a la persona: cada
integrante debe usar su propio usuario para que la atribución sea útil.

Las pruebas de `tests/workspace-isolation.test.mjs` cubren permisos, filtros,
paginación, eventos, conservación tras eliminaciones, ausencia de credenciales y
reversión de operaciones cuando falla la escritura del historial.
