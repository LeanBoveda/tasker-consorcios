# Manual del administrador

## 1. Responsabilidades del rol

El administrador puede:

- Crear, modificar y eliminar consorcios.
- Importar usuarios desde Excel o CSV.
- Editar nombre, usuario, rol y contraseña de cualquier perfil activo.
- Dar de baja perfiles.
- Eliminar tareas que tenga visibles.

El rol no otorga acceso automático a todas las tareas privadas.

## 2. Administrador inicial

En una base de datos nueva, Tasker crea un administrador inicial:

- Usuario: `admin`
- Contraseña: `admin123`

Después del primer ingreso se recomienda cambiar al menos la contraseña desde **Equipo > Editar**. La aplicación fue diseñada para un equipo pequeño y un esquema simple de acceso. No se deben reutilizar contraseñas personales o bancarias.

## 3. Administrar perfiles desde la página

### Editar un perfil

1. Abrir **Equipo**.
2. Presionar **Editar** en la fila correspondiente.
3. Cambiar nombre, usuario o rol.
4. Escribir una nueva contraseña solo si debe cambiarse.
5. Presionar **Guardar cambios**.

Si el campo de nueva contraseña queda vacío, la contraseña actual se conserva.

### Roles

| Rol visible | Valor interno | Permisos principales |
|---|---|---|
| Administrador | `admin` | Gestiona usuarios y consorcios. |
| Usuario | `member` | Gestiona sus tareas y las que le asignan. |

Debe quedar al menos un administrador activo.

### Eliminar un perfil

1. Abrir **Equipo**.
2. Presionar **Eliminar**.
3. Confirmar la baja.

El usuario desaparece del equipo, pierde sus sesiones y no puede volver a ingresar. Las tareas y los comentarios históricos se conservan. Internamente, el perfil queda inactivo con estado `invited`, por lo que puede reactivarse importando nuevamente el mismo usuario.

No se puede eliminar el propio perfil desde la sesión actual.

## 4. Importar usuarios desde Excel o CSV

La importación es útil para crear o actualizar varios perfiles juntos.

### Formatos aceptados

- `.xlsx`
- `.xls`
- `.csv`

### Columnas

| Columna | Obligatoria | Ejemplo |
|---|---:|---|
| `usuario` | Sí | `laura` |
| `nombre` | Sí | `Laura Martín` |
| `contraseña` | Sí | `laura123` |
| `rol` | No | `usuario` |

También se reconocen algunos encabezados equivalentes como `username`, `name`, `password`, `role`, `clave` o `tipo`.

### Valores de rol

- `admin` o `administrador`: crea un administrador.
- Cualquier otro valor, incluido `usuario`: crea un usuario común.

### Procedimiento

1. Abrir **Equipo**.
2. Presionar **Importar Excel**.
3. Descargar la plantilla si es necesario.
4. Elegir el archivo.
5. Revisar la vista previa.
6. Presionar **Importar usuarios**.

El límite actual es de 20 usuarios por archivo.

### Cómo se actualizan perfiles existentes

Tasker busca coincidencias por nombre de usuario, sin distinguir mayúsculas. Si encuentra una coincidencia:

- Actualiza nombre y rol.
- Reemplaza la contraseña.
- Reactiva el perfil si había sido eliminado.

El Excel debe guardarse con cuidado porque contiene contraseñas legibles. Todas las personas con acceso al archivo pueden conocerlas.

## 5. Administrar consorcios

### Agregar

1. Abrir **Consorcios**.
2. Completar nombre, dirección y notas.
3. Presionar **Agregar consorcio**.

El nombre es obligatorio y no puede repetirse.

### Editar

1. Presionar **Editar** junto al consorcio.
2. Cambiar los datos.
3. Presionar **Guardar cambios**.

Si cambia el nombre, Tasker actualiza también el nombre visible en las tareas relacionadas.

### Eliminar

1. Presionar **Eliminar**.
2. Confirmar.

El consorcio deja de aparecer en el catálogo. Las tareas existentes conservan el texto del nombre anterior para no perder contexto, pero quedan sin vínculo activo con el catálogo.

## 6. Criterios recomendados de uso

- Crear un usuario distinto para cada integrante.
- Evitar cuentas compartidas cuando se necesite saber quién comentó o creó una tarea.
- Usar nombres de consorcio uniformes, por ejemplo `Consorcio Cabildo 1842`.
- Registrar teléfonos o referencias de proveedores en la descripción o en comentarios.
- Mover una tarea a **En revisión** cuando dependa de una respuesta externa.
- Eliminar únicamente tareas de prueba o información que ya no deba conservarse.

## 7. Controles periódicos

### Semanal

- Revisar tareas vencidas o sin fecha.
- Revisar tareas en revisión.
- Confirmar que no haya tareas de prueba innecesarias.

### Mensual

- Revisar usuarios activos.
- Dar de baja a quien ya no deba ingresar.
- Confirmar que exista más de un administrador si la continuidad operativa lo requiere.
- Revisar el catálogo de consorcios.

### Antes de una modificación importante

- Confirmar que el código esté guardado en GitHub.
- Registrar o exportar los datos importantes antes de cambios directos en la base.
- Probar el flujo principal después de publicar.

## 8. Límites del administrador

Actualmente no existe una pantalla para:

- Ver todas las tareas privadas del equipo.
- Recuperar automáticamente una contraseña por correo.
- Restaurar tareas eliminadas.
- Exportar toda la base de datos desde la aplicación.
- Consultar un registro de auditoría independiente.
- Enviar notificaciones externas.
