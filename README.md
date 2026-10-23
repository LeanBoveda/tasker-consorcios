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
- Edición completa de tareas y panel separado de solo lectura.
- Notificaciones internas por asignación, comentarios, cambios, vencimientos e ingresos.
- Historial de actividad para administradores.
- Bandeja de ingresos automáticos para correo y WhatsApp.
- Panel de estado de la computadora receptora y sus fuentes.
- Demonio local para una casilla central de Gmail, con limpieza, deduplicación y reintentos.

## Privacidad de las tareas

Cada tarea solo es visible para quien la creó y, cuando corresponde, para la persona asignada. Los administradores pueden ver todas las tareas para supervisar el trabajo general.

## Tecnología

- React 19 y TypeScript.
- Vinext sobre Vite.
- Cloudflare Worker para el servidor.
- Cloudflare D1/SQLite para la base de datos.
- Drizzle para definir el esquema y generar migraciones.
- OpenAI Sites para el alojamiento actual.
- Python 3.11 para el demonio que funciona en la computadora de la administración.

## Desarrollo local

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
npm run build
npm test
npm run lint
```

La aplicación local utiliza el enlace D1 `DB` simulado por la configuración de Vite y Wrangler.

## Documentación

La documentación está dividida por audiencia:

- [Manual de usuario](docs/01-manual-de-usuario.md)
- [Manual del administrador](docs/02-manual-del-administrador.md)
- [Documentación técnica](docs/03-documentacion-tecnica.md)
- [Operación, mantenimiento y datos](docs/04-operacion-mantenimiento-y-datos.md)
- [Referencia de API y modelo de datos](docs/05-referencia-api-y-modelo-de-datos.md)
- [Demonio de correo y mensajería](docs/06-demonio-correo-y-mensajeria.md)

## Estado actual

Versión documentada: 1.2, octubre de 2026. Tasker está activo, cuenta con pruebas automáticas y el demonio 0.1 para Gmail central está preparado para instalar. La conexión de WhatsApp, los adjuntos reales y las notificaciones externas siguen pendientes.
