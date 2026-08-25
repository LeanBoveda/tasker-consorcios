from __future__ import annotations

from typing import Any
import httpx


class TaskerClient:
    def __init__(self, base_url: str, intake_key: str) -> None:
        self.client = httpx.Client(
            base_url=base_url,
            headers={"X-Tasker-Intake-Key": intake_key, "User-Agent": "TaskerDaemon/0.1"},
            timeout=httpx.Timeout(30.0, connect=10.0),
        )

    def send_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = self.client.post("/api/intake/events", json=payload)
        response.raise_for_status()
        return dict(response.json())

    def heartbeat(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = self.client.post("/api/daemon/heartbeat", json=payload)
        response.raise_for_status()
        return dict(response.json())

    def close(self) -> None:
        self.client.close()
