from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import tomllib


@dataclass(frozen=True, slots=True)
class TaskerSettings:
    base_url: str
    intake_key: str
    instance_id: str
    instance_name: str
    poll_seconds: int


@dataclass(frozen=True, slots=True)
class GmailSettings:
    enabled: bool
    account: str
    credentials_file: Path
    token_file: Path
    query: str


@dataclass(frozen=True, slots=True)
class StorageSettings:
    database_path: Path


@dataclass(frozen=True, slots=True)
class LoggingSettings:
    file: Path
    level: str


@dataclass(frozen=True, slots=True)
class DaemonSettings:
    tasker: TaskerSettings
    gmail: GmailSettings
    storage: StorageSettings
    logging: LoggingSettings


def load_settings(path: str | Path) -> DaemonSettings:
    config_path = Path(path).expanduser().resolve()
    if not config_path.exists():
        raise ValueError(f"No existe el archivo de configuración: {config_path}")
    with config_path.open("rb") as handle:
        raw = tomllib.load(handle)

    tasker = raw.get("tasker", {})
    gmail = raw.get("gmail", {})
    storage = raw.get("storage", {})
    logging = raw.get("logging", {})
    base_url = str(tasker.get("base_url", "")).strip().rstrip("/")
    intake_key = str(tasker.get("intake_key", "")).strip()
    if not base_url.startswith(("https://", "http://localhost", "http://127.0.0.1")):
        raise ValueError("La dirección de Tasker debe usar HTTPS")
    if not intake_key or intake_key.startswith("PEGAR_"):
        raise ValueError("Falta configurar la clave privada de conexión con Tasker")

    gmail_account = str(gmail.get("account", "")).strip().lower()
    gmail_enabled = bool(gmail.get("enabled", True))
    if gmail_enabled and "@" not in gmail_account:
        raise ValueError("La casilla central de Gmail no es válida")

    return DaemonSettings(
        tasker=TaskerSettings(
            base_url=base_url,
            intake_key=intake_key,
            instance_id=str(tasker.get("instance_id", "administracion-principal")).strip(),
            instance_name=str(tasker.get("instance_name", "PC Administración")).strip(),
            poll_seconds=max(15, min(int(tasker.get("poll_seconds", 30)), 300)),
        ),
        gmail=GmailSettings(
            enabled=gmail_enabled,
            account=gmail_account,
            credentials_file=Path(str(gmail.get("credentials_file", ""))).expanduser(),
            token_file=Path(str(gmail.get("token_file", ""))).expanduser(),
            query=str(gmail.get("query", "in:inbox -category:promotions -category:social")).strip(),
        ),
        storage=StorageSettings(
            database_path=Path(str(storage.get("database_path", "state.db"))).expanduser(),
        ),
        logging=LoggingSettings(
            file=Path(str(logging.get("file", "tasker-daemon.log"))).expanduser(),
            level=str(logging.get("level", "INFO")).upper(),
        ),
    )
