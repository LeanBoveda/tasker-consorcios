# Tasker Consorcios

Tasker es una aplicación interna para organizar el trabajo diario de una administración de consorcios. Permite crear tareas privadas, asignarlas a integrantes del equipo, seguir su estado, comentar avances y relacionarlas con un catálogo de edificios.

## Enlaces

- Aplicación publicada: [tasker-consorcios.cuentagpt050.chatgpt.site](https://tasker-consorcios.cuentagpt050.chatgpt.site)
- Repositorio: [github.com/LeanBoveda/tasker-consorcios](https://github.com/LeanBoveda/tasker-consorcios)
- Índice de documentación: [docs/README.md](docs/README.md)
- Manual completo en Word: [docs/Documentacion-Tasker-Consorcios.docx](docs/Documentacion-Tasker-Consorcios.docx)

## Funciones principales

- Inicio de sesión con usuarios propios de Tasker.
- Tareas privadas por defecto.
- Asignación de tareas a otra persona.
- Estados: pendiente, en curso, en revisión y finalizada.
- Prioridades baja, media y alta.
- Comentarios compartidos entre creador y persona asignada.
- Catálogo administrable de consorcios.
- Administración de usuarios desde la página o mediante Excel/CSV.
- Eliminación de tareas, perfiles y consorcios con confirmación.
- Búsqueda y filtros por persona y consorcio.

## Privacidad de las tareas

Cada tarea solo es visible para quien la creó y, cuando corresponde, para la persona asignada. El rol administrador permite gestionar usuarios y consorcios, pero no habilita automáticamente la lectura de todas las tareas privadas.

## Tecnología

- React 19 y TypeScript.
- Vinext sobre Vite.
- Cloudflare Worker para el servidor.
- Cloudflare D1/SQLite para la base de datos.
- Drizzle para definir el esquema y generar migraciones.
- OpenAI Sites para el alojamiento actual.

## Desarrollo local

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
npm run build
```

La aplicación local utiliza el enlace D1 `DB` simulado por la configuración de Vite y Wrangler.

## Documentación

La documentación está dividida por audiencia:

- [Manual de usuario](docs/01-manual-de-usuario.md)
- [Manual del administrador](docs/02-manual-del-administrador.md)
- [Documentación técnica](docs/03-documentacion-tecnica.md)
- [Operación, mantenimiento y datos](docs/04-operacion-mantenimiento-y-datos.md)
- [Referencia de API y modelo de datos](docs/05-referencia-api-y-modelo-de-datos.md)

## Estado actual

Versión documentada: 1.0, agosto de 2026. La aplicación está activa y publicada. Las notificaciones externas, los adjuntos y la recuperación automática de contraseñas no forman parte de la versión actual.
