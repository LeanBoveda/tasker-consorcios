$ErrorActionPreference = "Stop"
$TaskerJob = Get-ScheduledTask -TaskName "TaskerDaemon" -ErrorAction SilentlyContinue
if ($TaskerJob) {
  Stop-ScheduledTask -TaskName "TaskerDaemon" -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName "TaskerDaemon" -Confirm:$false
}
Write-Host "El inicio automático fue eliminado. La configuración, la sesión de Google y los registros se conservaron en ProgramData\TaskerDaemon." -ForegroundColor Green
