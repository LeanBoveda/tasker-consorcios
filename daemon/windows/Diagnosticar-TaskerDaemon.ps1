$ErrorActionPreference = "Stop"
$TaskerDataRoot = Join-Path $env:ProgramData "TaskerDaemon"
$TaskerPython = Join-Path $TaskerDataRoot "venv\Scripts\python.exe"
$TaskerConfig = Join-Path $TaskerDataRoot "config\config.toml"
if (-not (Test-Path -LiteralPath $TaskerPython)) { throw "Tasker Daemon no está instalado." }
& $TaskerPython -m tasker_daemon --config $TaskerConfig doctor
Get-ScheduledTask -TaskName "TaskerDaemon" | Get-ScheduledTaskInfo | Format-List
Write-Host "Últimas líneas del registro:" -ForegroundColor Cyan
Get-Content -LiteralPath (Join-Path $TaskerDataRoot "logs\tasker-daemon.log") -Tail 30
