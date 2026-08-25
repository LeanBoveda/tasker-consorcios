# Demonio de correo y mensajería

## Alcance de la primera versión

Tasker Daemon 0.1 funciona en una computadora Windows de la administración y consulta una única casilla central de Gmail. Las cuentas operativas reenvían allí sus mensajes nuevos con filtros que excluyen spam, promociones y redes sociales.

Esta versión no conecta todavía WhatsApp. La arquitectura, el panel de fuentes y el formato de eventos ya contemplan su incorporación posterior.

## Flujo

```text
Gmail operativos
  -> reenvío filtrado
  -> casilla central
  -> Gmail API (solo lectura)
  -> Tasker Daemon
  -> limpieza, clasificación y cola local
  -> /api/intake/events
  -> Bandeja del demonio y tareas
```

## Punto de activación

En la primera consulta el demonio guarda el identificador actual del historial de Gmail. No importa mensajes ni conversaciones anteriores. Desde ese momento recupera mensajes nuevos aunque la PC pierda temporalmente la conexión.

## Tratamiento del correo

- Lee asunto, cuerpo, remitente, destinatario original, fecha, conversación y metadatos de adjuntos.
- Elimina encabezados de reenvío, contenido citado de cadenas anteriores, firmas y avisos legales comunes.
- Omite etiquetas de spam, papelera, enviados, borradores, promociones y redes sociales.
- No omite `Actualizaciones` ni `no-reply`, porque allí pueden llegar avisos válidos de portales.
- Clasifica tipo, prioridad y señales de resolución o recurrencia.
- Deduplica por identificador original aunque varias cuentas reenvíen el mismo mensaje.

## Conversaciones y tareas finalizadas

Una conversación nueva crea una tarea en revisión. Una respuesta sobre una tarea activa se agrega como comentario externo. Si la tarea estaba finalizada:

- Una indicación clara de que el problema continúa la reabre como pendiente.
- Una confirmación de solución o agradecimiento queda registrada sin reabrir.
- Un mensaje nuevo y ambiguo crea otra tarea en revisión, sin alterar la finalizada.

## Continuidad y diagnóstico

Antes de avanzar el cursor de Gmail, cada evento queda guardado en una cola SQLite local. Si Tasker o Internet no responden, se reintenta con espera creciente. El panel **Demonio** muestra la última señal de la PC, versión, casilla central, último control, último mensaje y errores.

Los archivos de instalación y la guía detallada están en `daemon/windows` y `daemon/docs`.
