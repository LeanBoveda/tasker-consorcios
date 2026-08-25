param(
  [string]$GmailAccount = "",
  [string]$TaskerKey = "",
  [string]$GoogleCredentialsFile = ""
)

$ErrorActionPreference = "Stop"
$TaskerDataRoot = Join-Path $env:ProgramData "TaskerDaemon"
$TaskerConfigRoot = Join-Path $TaskerDataRoot "config"
$TaskerStateRoot = Join-Path $TaskerDataRoot "data"
$TaskerLogRoot = Join-Path $TaskerDataRoot "logs"
$TaskerVenvRoot = Join-Path $TaskerDataRoot "venv"
$TaskerConfigFile = Join-Path $TaskerConfigRoot "config.toml"
$TaskerProjectRoot = Split-Path -Parent $PSScriptRoot
$TaskerName = "TaskerDaemon"

function Select-GoogleCredentialsFile {
  Add-Type -AssemblyName System.Windows.Forms
  $TaskerDialog = New-Object System.Windows.Forms.OpenFileDialog
  $TaskerDialog.Title = "Elegir el archivo JSON descargado desde Google Cloud"
  $TaskerDialog.Filter = "Archivo JSON (*.json)|*.json"
  if ($TaskerDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    throw "No se eligió el archivo de autorización de Google."
  }
  return $TaskerDialog.FileName
}

if (-not $GmailAccount) { $GmailAccount = Read-Host "Casilla central de Gmail" }
if (-not $TaskerKey) { $TaskerKey = Read-Host "Clave privada de conexión con Tasker" }
if (-not $GoogleCredentialsFile) { $GoogleCredentialsFile = Select-GoogleCredentialsFile }
if ($GmailAccount -notmatch "@") { throw "La casilla de Gmail no es válida." }
if (-not (Test-Path -LiteralPath $GoogleCredentialsFile)) { throw "No se encontró el archivo JSON de Google." }

$TaskerPythonCommand = Get-Command py -ErrorAction SilentlyContinue
if ($TaskerPythonCommand) {
  $TaskerPythonExecutable = $TaskerPythonCommand.Source
  $TaskerPythonArguments = @("-3.11")
} else {
  $TaskerPythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if (-not $TaskerPythonCommand) {
    throw "Python 3.11 o superior no está instalado. Instalalo desde python.org y volvé a ejecutar este archivo."
  }
  $TaskerPythonExecutable = $TaskerPythonCommand.Source
  $TaskerPythonArguments = @()
}

New-Item -ItemType Directory -Force -Path $TaskerConfigRoot, $TaskerStateRoot, $TaskerLogRoot | Out-Null
& $TaskerPythonExecutable @TaskerPythonArguments -m venv $TaskerVenvRoot
$TaskerDaemonPython = Join-Path $TaskerVenvRoot "Scripts\python.exe"
& $TaskerDaemonPython -m pip install --upgrade pip
& $TaskerDaemonPython -m pip install $TaskerProjectRoot

$TaskerGoogleSecret = Join-Path $TaskerConfigRoot "google-client-secret.json"
Copy-Item -LiteralPath $GoogleCredentialsFile -Destination $TaskerGoogleSecret -Force
$TaskerDatabasePath = (Join-Path $TaskerStateRoot "state.db").Replace("\", "/")
$TaskerLogPath = (Join-Path $TaskerLogRoot "tasker-daemon.log").Replace("\", "/")
$TaskerSecretPath = $TaskerGoogleSecret.Replace("\", "/")
$TaskerTokenPath = (Join-Path $TaskerConfigRoot "gmail-token.json").Replace("\", "/")
$TaskerSafeKey = $TaskerKey.Replace('"', '\"')

@"
[tasker]
base_url = "https://tasker-consorcios.cuentagpt050.chatgpt.site"
intake_key = "$TaskerSafeKey"
instance_id = "administracion-principal"
instance_name = "PC Administración"
poll_seconds = 30

[storage]
database_path = "$TaskerDatabasePath"

[gmail]
enabled = true
account = "$GmailAccount"
credentials_file = "$TaskerSecretPath"
token_file = "$TaskerTokenPath"
query = "in:inbox -category:promotions -category:social"

[logging]
file = "$TaskerLogPath"
level = "INFO"
"@ | Set-Content -LiteralPath $TaskerConfigFile -Encoding UTF8

Write-Host "Se abrirá Google para vincular la casilla central." -ForegroundColor Cyan
& $TaskerDaemonPython -m tasker_daemon --config $TaskerConfigFile authorize-gmail
& $TaskerDaemonPython -m tasker_daemon --config $TaskerConfigFile doctor

$TaskerAction = New-ScheduledTaskAction -Execute $TaskerDaemonPython -Argument "-m tasker_daemon --config `"$TaskerConfigFile`" run"
$TaskerTrigger = New-ScheduledTaskTrigger -AtStartup
$TaskerPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$TaskerSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 20 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName $TaskerName -Action $TaskerAction -Trigger $TaskerTrigger -Principal $TaskerPrincipal -Settings $TaskerSettings -Description "Receptor de Gmail y WhatsApp para Tasker Consorcios" -Force | Out-Null
Start-ScheduledTask -TaskName $TaskerName

Write-Host "Tasker Daemon quedó instalado y en ejecución." -ForegroundColor Green
Write-Host "Podés revisar su estado desde la sección Demonio de Tasker."
