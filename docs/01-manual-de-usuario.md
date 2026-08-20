# Manual de usuario

## 1. Objetivo

Tasker permite registrar y seguir las gestiones diarias de la administración. Cada persona trabaja con sus propias tareas y con las que otra persona le asigna.

## 2. Ingreso y salida

### Ingresar

1. Abrir <https://tasker-consorcios.cuentagpt050.chatgpt.site>.
2. Escribir el usuario y la contraseña entregados por la administración.
3. Presionar **Ingresar**.

Las credenciales también pueden figurar en el Excel compartido del equipo. Si no funcionan, un administrador debe editar el perfil o volver a importar el usuario.

### Salir

Presionar el perfil ubicado en la parte inferior izquierda. El botón muestra la palabra **Salir**. Al cerrar sesión, se elimina la sesión actual del navegador.

## 3. Pantalla principal

La pantalla está organizada en cinco áreas:

- **Menú lateral:** Inicio, Mis tareas, Equipo, Consorcios y Actividad.
- **Resumen:** tareas activas, tareas delegadas y finalizadas durante la última semana.
- **Búsqueda y filtros:** permiten reducir las tareas visibles.
- **Tablero:** separa las tareas en cuatro columnas según su estado.
- **Ficha de tarea:** se abre al seleccionar una tarjeta.

El tablero usa estos estados:

| Estado | Uso recomendado |
|---|---|
| Pendiente | La gestión todavía no comenzó. |
| En curso | Alguien está trabajando en ella. |
| En revisión | Falta una confirmación, control o respuesta. |
| Finalizada | La gestión terminó. |

## 4. Privacidad

Las tareas son privadas por defecto.

- Si no se asigna una persona, solo la ve quien la creó.
- Si se asigna una persona, la ven el creador y el asignado.
- Ambas personas pueden cambiar el estado y agregar comentarios.
- El administrador no ve automáticamente las tareas privadas de todo el equipo.

La privacidad depende del creador y del asignado registrados en la base de datos. No se deben compartir usuarios entre personas si se necesita conservar una separación clara de tareas.

## 5. Crear una tarea

1. Presionar **Nueva tarea** o **Agregar tarea** dentro de una columna.
2. Completar el título.
3. Agregar una descripción cuando sea útil.
4. Elegir un consorcio del catálogo o dejar **Sin consorcio**.
5. Elegir una fecha límite, prioridad y persona asignada.
6. Presionar **Crear tarea**.

Si se crea la tarea desde una columna, empieza en el estado de esa columna. Si se usa el botón superior, empieza como pendiente.

### Datos de una tarea

- **Título:** gestión concreta que debe realizarse.
- **Descripción:** contexto, proveedor, teléfono, presupuesto o próximos pasos.
- **Consorcio:** edificio relacionado.
- **Fecha límite:** vencimiento previsto.
- **Prioridad:** baja, media o alta.
- **Asignada a:** persona que colaborará con el creador.

## 6. Consultar y actualizar una tarea

Presionar una tarjeta para abrir su ficha lateral.

El creador puede cambiar:

- Estado.
- Prioridad.
- Persona asignada.
- Consorcio.

La persona asignada puede cambiar el estado y comentar, pero no puede modificar la prioridad, la asignación ni el consorcio.

La versión actual muestra el vencimiento, pero no permite editarlo desde la ficha. Tampoco permite editar el título o la descripción desde la interfaz después de crear la tarea.

## 7. Comentarios

Los comentarios sirven como historial de seguimiento.

1. Abrir la tarea.
2. Escribir una actualización en el cuadro de comentarios.
3. Presionar **Comentar**.

Los comentarios muestran autor, fecha y hora. Solo pueden comentar el creador y la persona asignada. Al eliminar una tarea, se eliminan definitivamente todos sus comentarios.

## 8. Buscar y filtrar

### Buscar

Presionar la lupa y escribir una palabra. La búsqueda revisa título, descripción y nombre del consorcio.

### Filtrar

Se puede filtrar por:

- Persona asignada.
- Consorcio.

Los filtros se aplican únicamente sobre las tareas que el usuario ya tiene permiso para ver.

### Mis tareas

La vista **Mis tareas** incluye:

- Tareas asignadas al usuario.
- Tareas privadas creadas por el usuario.

Las tareas creadas por el usuario y delegadas a otra persona siguen disponibles desde **Inicio**, aunque no necesariamente aparecen en **Mis tareas**.

## 9. Eliminar una tarea

El creador puede eliminar su tarea. Un administrador también puede eliminar una tarea que tenga visible por ser creador o asignado.

1. Abrir la tarea.
2. Ir al bloque **¿Es una tarea finalizada o de prueba?**.
3. Presionar **Eliminar tarea**.
4. Confirmar la eliminación.

La eliminación es definitiva e incluye todos los comentarios. No existe papelera ni restauración desde la página.

## 10. Equipo y consorcios

Todos los usuarios activos pueden abrir:

- **Equipo:** lista de integrantes y roles.
- **Consorcios:** catálogo de edificios, direcciones y notas.

Solo un administrador puede modificar esas listas.

## 11. Avisos y actividad

La versión actual no envía correos, mensajes de teléfono ni notificaciones push.

- El botón de campana muestra un aviso informativo.
- La opción **Actividad** recuerda que el seguimiento se encuentra dentro de cada tarea.
- Para conocer novedades, hay que ingresar a Tasker y revisar las tareas compartidas.

## 12. Problemas frecuentes

### No puedo iniciar sesión

- Revisar mayúsculas, minúsculas y espacios.
- Confirmar la contraseña con el administrador.
- Pedir que editen el perfil o vuelvan a importar el usuario.

### No encuentro una tarea

- Revisar si está activa la vista **Mis tareas**.
- Limpiar la búsqueda y los filtros.
- Confirmar quién creó la tarea y a quién fue asignada.

### No puedo modificar algunos campos

Solo el creador puede cambiar prioridad, asignación y consorcio. El asignado puede actualizar el estado y comentar.

### Un consorcio no aparece al crear una tarea

Un administrador debe agregarlo al catálogo de Consorcios.
