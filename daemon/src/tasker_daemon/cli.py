from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import sys

from .config import load_settings
from .gmail import GmailConnector
from .service import DaemonRunner, configure_logging
from .state import StateStore
from .tasker_client import TaskerClient


DEFAULT_CONFIG = Path("C:/ProgramData/TaskerDaemon/config/config.toml")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="tasker-daemon", description="Receptor local de Tasker Consorcios")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Archivo config.toml")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("authorize-gmail", help="Vincula la casilla central de Gmail")
    run_parser = commands.add_parser("run", help="Inicia el receptor")
    run_parser.add_argument("--once", action="store_true", help="Ejecuta un solo control y termina")
    commands.add_parser("doctor", help="Comprueba configuración, Gmail y Tasker")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        settings = load_settings(args.config)
        configure_logging(settings)
        if args.command == "authorize-gmail":
            state = StateStore(settings.storage.database_path)
            try:
                account = GmailConnector(settings.gmail, state).authorize(interactive=True)
                print(f"Gmail vinculado correctamente: {account}")
            finally:
                state.close()
            return 0
        if args.command == "doctor":
            return _doctor(settings)
        DaemonRunner(settings).run(once=bool(args.once))
        return 0
    except KeyboardInterrupt:
        return 130
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


def _doctor(settings) -> int:
    print("Configuración: OK")
    state = StateStore(settings.storage.database_path)
    try:
        connector = GmailConnector(settings.gmail, state)
        account = connector.authorize(interactive=False)
        print(f"Gmail: OK ({account})")
        client = TaskerClient(settings.tasker.base_url, settings.tasker.intake_key)
        try:
            client.heartbeat({
                "instanceId": settings.tasker.instance_id,
                "name": settings.tasker.instance_name,
                "hostName": "comprobacion",
                "version": "0.1.0",
                "status": "online",
                "sources": [{
                    "kind": "email", "account": account, "displayName": "Casilla central",
                    "status": "connected",
                }],
            })
            print("Tasker: OK")
        finally:
            client.close()
    finally:
        state.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
