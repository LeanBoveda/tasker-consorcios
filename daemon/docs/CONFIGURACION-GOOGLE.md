# Configuración de Google para la casilla central

1. Entrar a Google Cloud Console con una cuenta de la organización.
2. Crear un proyecto llamado `Tasker Daemon`.
3. Habilitar **Gmail API**.
4. Configurar la pantalla de consentimiento OAuth. Si todas las cuentas pertenecen al mismo Google Workspace, usar tipo interno.
5. Crear un cliente OAuth con tipo **Aplicación de escritorio**.
6. Descargar el JSON y conservarlo para el instalador.

El demonio solicita únicamente `gmail.readonly`: puede leer mensajes y adjuntos, pero no puede enviar, borrar, marcar ni modificar correos.

La sesión queda guardada localmente en la computadora de la administración. La contraseña de Gmail no se guarda en Tasker, GitHub ni en el archivo de configuración.

Si Google invalida la sesión, el panel Demonio mostrará Gmail como desconectado y habrá que repetir la autorización.
