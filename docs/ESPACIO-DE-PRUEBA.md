# Perfil de prueba independiente

El usuario `test` pertenece al espacio `test`. Las cuentas existentes continúan
en `main`. El inicio de sesión usa la misma página y cada sesión obtiene su espacio
desde la base de datos: no se acepta un espacio enviado por el navegador.

## Alcance

- `test` administra únicamente su equipo, consorcios, tareas e ingresos de prueba.
- Los administradores habituales ven todas las tareas de `main`, nunca las de `test`.
- No se pueden asignar tareas a personas ni consorcios del otro espacio.
- Los comentarios heredan el acceso de su tarea. Editar, borrar, importar usuarios,
  revisar ingresos y limpiar tareas también respetan esta separación.
- Los usuarios creados por Excel quedan en el espacio de quien importa. Los nombres
  de inicio de sesión son únicos en toda la aplicación: una coincidencia con una
  cuenta del otro espacio rechaza la importación, sin modificarla.
- La pantalla muestra una banda «Modo de prueba». No se copian datos reales.
- El demonio y su clave de integración siguen recibiendo ingresos en `main`.
  El perfil de prueba puede usar «Simular ingreso», sin acceder al demonio real.
- La importación y edición deben dejar al menos un administrador activo por espacio.

## Implementación y límites

La separación es lógica dentro de la misma aplicación y base D1; no es una segunda
base de datos ni un despliegue distinto. Quien tenga acceso directo a la base o al
repositorio puede ver ambos espacios. No cambia las credenciales reales.

La migración `0012` conserva los datos anteriores en `main` y crea la cuenta de
prueba una sola vez, sin sobrescribir cuentas existentes. Su contraseña puede
modificarse desde Equipo, ingresando como `test`. No se debe ejecutar nuevamente
la migración para restablecer una contraseña.

Las pruebas `tests/workspace-isolation.test.mjs` ejecutan los stores reales sobre
SQLite en memoria: migraciones, inicio de sesión, aislamiento de lecturas,
operaciones cruzadas, importación, entradas del demonio y limpieza por espacio.
