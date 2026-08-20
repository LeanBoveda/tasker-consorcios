# Documentación de Tasker Consorcios

Esta carpeta reúne la documentación funcional, administrativa y técnica de Tasker. El contenido refleja el estado real de la aplicación publicado en agosto de 2026.

## Documentos disponibles

1. [Manual de usuario](01-manual-de-usuario.md): acceso, tablero, privacidad, tareas, comentarios, búsqueda y filtros.
2. [Manual del administrador](02-manual-del-administrador.md): usuarios, importación desde Excel, perfiles, roles y consorcios.
3. [Documentación técnica](03-documentacion-tecnica.md): arquitectura, seguridad, permisos, estructura del código y limitaciones.
4. [Operación, mantenimiento y datos](04-operacion-mantenimiento-y-datos.md): alojamiento, base de datos, copias de seguridad, publicación y solución de problemas.
5. [Referencia de API y modelo de datos](05-referencia-api-y-modelo-de-datos.md): endpoints, tablas, relaciones y reglas de integridad.
6. [Manual completo en Word](Documentacion-Tasker-Consorcios.docx): versión consolidada para compartir, imprimir o archivar.

## Datos de referencia

- Nombre: Tasker Consorcios.
- Aplicación: <https://tasker-consorcios.cuentagpt050.chatgpt.site>
- Código fuente: <https://github.com/LeanBoveda/tasker-consorcios>
- Alojamiento actual: OpenAI Sites.
- Base de datos de producción: Cloudflare D1, enlace lógico `DB`.
- Tablas: `users`, `sessions`, `consorcios`, `tasks` y `comments`.

## Cómo mantener esta documentación

Cuando se agregue o modifique una función:

1. Actualizar el manual correspondiente.
2. Actualizar la referencia técnica si cambia la API, los permisos o la base de datos.
3. Regenerar el manual de Word.
4. Verificar que los enlaces y credenciales iniciales sigan siendo correctos.
5. Subir la documentación actualizada a GitHub junto con el cambio de la aplicación.

## Alcance

La documentación cubre la versión actual. No describe como funciones disponibles los avisos por correo, WhatsApp, SMS, notificaciones push, adjuntos ni recuperación de contraseña, porque todavía no están implementados.
