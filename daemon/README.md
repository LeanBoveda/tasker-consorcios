# Tasker Daemon

Servicio local que consulta la casilla central de Gmail y envía los mensajes nuevos a Tasker Consorcios. Esta primera versión deja preparada la arquitectura para incorporar después las líneas de WhatsApp.

## Qué hace la versión 0.1

- Empieza desde el momento de activación; no importa conversaciones anteriores.
- Lee asunto, cuerpo, remitente, destinatario original y metadatos de adjuntos.
- Limpia encabezados de reenvío, respuestas citadas, firmas y avisos de confidencialidad.
- Omite spam, promociones y redes sociales.
- Clasifica reclamos, solicitudes, pedidos, avisos y prioridad.
- Evita duplicados aunque el mismo mensaje haya sido reenviado por varias cuentas.
- Conserva una cola SQLite cuando no hay Internet o Tasker no responde.
- Envía una señal de estado para mostrar la PC y Gmail en el panel Demonio de Tasker.
- Agrupa respuestas por conversación. Tasker agrega comentarios, reabre una tarea si el problema continúa y evita reabrirla ante un simple agradecimiento.

## Instalación en Windows

La guía completa está en [docs/INSTALACION-WINDOWS.md](docs/INSTALACION-WINDOWS.md). El instalador es `windows/Instalar-TaskerDaemon.ps1` y registra el proceso para que comience automáticamente con Windows.

## Desarrollo y pruebas

Requiere Python 3.11 o superior.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Los secretos, tokens, estado local y registros se guardan fuera del repositorio, en `C:\ProgramData\TaskerDaemon`.
