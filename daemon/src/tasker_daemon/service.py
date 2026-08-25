from __future__ import annotations

import json
import logging
from logging.handlers import RotatingFileHandler
import platform
import signal
import time
from typing import Any

from . import __version__
from .classifier import is_noise
from .config import DaemonSettings
from .gmail import GmailConnector
from .state import StateStore
from .tasker_client import TaskerClient


LOGGER = logging.getLogger(__name__)


class DaemonRunner:
    def __init__(self, settings: DaemonSettings) -> None:
        self.settings = settings
        self.state = StateStore(settings.storage.database_path)
        self.tasker = TaskerClient(settings.tasker.base_url, settings.tasker.intake_key)
        self.gmail = GmailConnector(settings.gmail, self.state) if settings.gmail.enabled else None
        self.started_at = int(time.time() * 1000)
        self.running = True
        self.last_message_at: int | None = None
        self.source_status = "connected"
        self.source_error = ""

    def run(self, once: bool = False) -> None:
        self._install_signal_handlers()
        LOGGER.info("Tasker Daemon %s iniciado en %s", __version__, platform.node())
        try:
            while self.running:
                cycle_started = time.monotonic()
                self._cycle()
                if once:
                    break
                remaining = self.settings.tasker.poll_seconds - (time.monotonic() - cycle_started)
                self._interruptible_wait(max(1.0, remaining))
        finally:
            self._heartbeat(final=True)
            self.tasker.close()
            self.state.close()
            LOGGER.info("Tasker Daemon detenido")

    def _cycle(self) -> None:
        try:
            if self.gmail:
                batch = self.gmail.poll()
                for event in batch.events:
                    payload = event.as_payload()
                    if self.state.has_external_id(event.source, event.external_id):
                        continue
                    self.state.enqueue(payload)
                    self.last_message_at = max(self.last_message_at or 0, event.received_at)
                self.gmail.commit(batch.next_history_id)
                self.source_status = "connected"
                self.source_error = ""
        except Exception as error:  # The loop must stay alive after provider failures.
            self.source_status = "disconnected"
            self.source_error = str(error)[:2000]
            LOGGER.exception("No se pudo consultar Gmail")

        self._flush_outbox()
        self._heartbeat()

    def _flush_outbox(self) -> None:
        for row in list(self.state.due_items()):
            payload = json.loads(str(row["payload_json"]))
            try:
                result = self.tasker.send_event(payload)
                self.state.complete(int(row["id"]), payload, result)
                LOGGER.info(
                    "Mensaje enviado a Tasker: %s (%s)",
                    payload.get("title", "sin título"), result.get("action", "procesado"),
                )
            except Exception as error:  # Queue retry protects against connection loss.
                attempts = int(row["attempts"]) + 1
                self.state.retry(int(row["id"]), attempts, str(error))
                LOGGER.warning("Tasker no respondió; reintento %s programado: %s", attempts, error)

    def _heartbeat(self, final: bool = False) -> None:
        pending = self.state.pending_count()
        daemon_status = "error" if self.source_status == "disconnected" else "degraded" if pending else "online"
        error = self.source_error or (f"Hay {pending} mensajes esperando reintento" if pending else "")
        sources: list[dict[str, Any]] = []
        if self.gmail:
            sources.append({
                "kind": "email",
                "account": self.settings.gmail.account,
                "displayName": "Casilla central",
                "status": "disabled" if final else self.source_status,
                "lastCheckedAt": int(time.time() * 1000),
                "lastMessageAt": self.last_message_at,
                "lastError": self.source_error,
            })
        payload = {
            "instanceId": self.settings.tasker.instance_id,
            "name": self.settings.tasker.instance_name,
            "hostName": platform.node(),
            "version": __version__,
            "status": daemon_status,
            "startedAt": self.started_at,
            "lastError": error,
            "sources": sources,
        }
        try:
            self.tasker.heartbeat(payload)
        except Exception as heartbeat_error:
            LOGGER.warning("No se pudo informar el estado a Tasker: %s", heartbeat_error)

    def _install_signal_handlers(self) -> None:
        def stop(_signum: int, _frame: object) -> None:
            self.running = False

        signal.signal(signal.SIGINT, stop)
        if hasattr(signal, "SIGTERM"):
            signal.signal(signal.SIGTERM, stop)

    def _interruptible_wait(self, seconds: float) -> None:
        deadline = time.monotonic() + seconds
        while self.running and time.monotonic() < deadline:
            time.sleep(min(0.5, deadline - time.monotonic()))


def configure_logging(settings: DaemonSettings, console: bool = True) -> None:
    settings.logging.file.parent.mkdir(parents=True, exist_ok=True)
    handlers: list[logging.Handler] = [
        RotatingFileHandler(settings.logging.file, maxBytes=5_000_000, backupCount=5, encoding="utf-8")
    ]
    if console:
        handlers.append(logging.StreamHandler())
    logging.basicConfig(
        level=getattr(logging, settings.logging.level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=handlers,
        force=True,
    )
