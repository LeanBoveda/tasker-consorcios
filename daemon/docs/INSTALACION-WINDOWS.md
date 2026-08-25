# Instalación de Tasker Daemon en Windows

## Antes de instalar

1. Crear una casilla real, por ejemplo `sistemademon@adminbsas.com.ar`.
2. Configurar cada cuenta de la administración para reenviar mensajes nuevos a esa casilla.
3. En los filtros de Gmail excluir `Promociones` y `Social`. No excluir `Actualizaciones` ni remitentes `no-reply`, porque allí pueden llegar solicitudes válidas de portales.
4. Crear credenciales OAuth de tipo **Aplicación de escritorio** en Google Cloud y descargar el archivo JSON.
5. Instalar Python 3.11 o superior en la computadora que permanecerá encendida.

## Ejecutar el instalador

1. Descargar o clonar este repositorio en la computadora de la administración.
2. Abrir PowerShell como administrador.
3. Ejecutar `daemon\windows\Instalar-TaskerDaemon.ps1`.
4. Indicar la casilla central, la clave privada de Tasker y elegir el JSON descargado de Google.
5. Iniciar sesión en Google cuando se abra el navegador y aceptar el acceso de solo lectura a Gmail.

El instalador comprueba Gmail y Tasker, registra el inicio automático y pone en marcha el receptor. Su estado aparecerá en **Tasker → Demonio**.

## Datos locales

Todo lo que no debe subirse a GitHub queda en `C:\ProgramData\TaskerDaemon`:

- `config\config.toml`: configuración y clave de conexión.
- `config\gmail-token.json`: sesión OAuth de Gmail.
- `data\state.db`: cursor, deduplicación y cola pendiente.
- `logs\tasker-daemon.log`: registro rotativo de funcionamiento.

## Diagnóstico y desinstalación

- `Diagnosticar-TaskerDaemon.ps1` comprueba Gmail, Tasker, la tarea de Windows y muestra el registro reciente.
- `Desinstalar-TaskerDaemon.ps1` detiene el inicio automático, pero conserva la sesión y los registros para poder recuperarlos.

## Comportamiento inicial

La primera consulta guarda el punto de activación y no envía correos anteriores. Si el servicio se detiene, al volver a iniciar recupera únicamente los mensajes nuevos recibidos desde el último control confirmado.
