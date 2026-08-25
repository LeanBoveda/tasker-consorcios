from __future__ import annotations

from contextlib import closing
from pathlib import Path
import json
import sqlite3
import time
from typing import Any, Iterator


class StateStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(path)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA foreign_keys=ON")
        self._initialize()

    def _initialize(self) -> None:
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS metadata (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS outbox (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              source TEXT NOT NULL,
              source_account TEXT NOT NULL,
              external_id TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              attempts INTEGER NOT NULL DEFAULT 0,
              next_attempt_at INTEGER NOT NULL,
              last_error TEXT NOT NULL DEFAULT '',
              created_at INTEGER NOT NULL,
              UNIQUE(source, source_account, external_id)
            );
            CREATE TABLE IF NOT EXISTS processed_messages (
              source TEXT NOT NULL,
              source_account TEXT NOT NULL,
              external_id TEXT NOT NULL,
              result_json TEXT NOT NULL DEFAULT '{}',
              processed_at INTEGER NOT NULL,
              PRIMARY KEY(source, source_account, external_id)
            );
            CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox(next_attempt_at, id);
            """
        )
        self.connection.commit()

    def get(self, key: str) -> str | None:
        row = self.connection.execute("SELECT value FROM metadata WHERE key = ?", (key,)).fetchone()
        return str(row["value"]) if row else None

    def set(self, key: str, value: str) -> None:
        self.connection.execute(
            "INSERT INTO metadata(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        self.connection.commit()

    def is_processed(self, source: str, account: str, external_id: str) -> bool:
        row = self.connection.execute(
            "SELECT 1 FROM processed_messages WHERE source = ? AND source_account = ? AND external_id = ?",
            (source, account, external_id),
        ).fetchone()
        return row is not None

    def has_external_id(self, source: str, external_id: str) -> bool:
        processed = self.connection.execute(
            "SELECT 1 FROM processed_messages WHERE source = ? AND external_id = ? LIMIT 1",
            (source, external_id),
        ).fetchone()
        if processed:
            return True
        queued = self.connection.execute(
            "SELECT 1 FROM outbox WHERE source = ? AND external_id = ? LIMIT 1",
            (source, external_id),
        ).fetchone()
        return queued is not None

    def enqueue(self, payload: dict[str, Any]) -> None:
        now = int(time.time() * 1000)
        self.connection.execute(
            """INSERT OR IGNORE INTO outbox
               (source, source_account, external_id, payload_json, next_attempt_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (payload["source"], payload["sourceAccount"], payload["externalId"], json.dumps(payload, ensure_ascii=False), now, now),
        )
        self.connection.commit()

    def due_items(self, limit: int = 50) -> Iterator[sqlite3.Row]:
        now = int(time.time() * 1000)
        rows = self.connection.execute(
            "SELECT * FROM outbox WHERE next_attempt_at <= ? ORDER BY id LIMIT ?", (now, limit)
        ).fetchall()
        yield from rows

    def complete(self, row_id: int, payload: dict[str, Any], result: dict[str, Any]) -> None:
        now = int(time.time() * 1000)
        with self.connection:
            self.connection.execute(
                """INSERT INTO processed_messages(source, source_account, external_id, result_json, processed_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(source, source_account, external_id) DO UPDATE SET
                     result_json = excluded.result_json, processed_at = excluded.processed_at""",
                (payload["source"], payload["sourceAccount"], payload["externalId"], json.dumps(result, ensure_ascii=False), now),
            )
            self.connection.execute("DELETE FROM outbox WHERE id = ?", (row_id,))

    def mark_ignored(self, source: str, account: str, external_id: str, reason: str) -> None:
        now = int(time.time() * 1000)
        self.connection.execute(
            """INSERT OR IGNORE INTO processed_messages
               (source, source_account, external_id, result_json, processed_at) VALUES (?, ?, ?, ?, ?)""",
            (source, account, external_id, json.dumps({"ignored": reason}, ensure_ascii=False), now),
        )
        self.connection.commit()

    def retry(self, row_id: int, attempts: int, error: str) -> None:
        delay_seconds = min(900, 5 * (2 ** min(attempts, 7)))
        next_attempt_at = int((time.time() + delay_seconds) * 1000)
        self.connection.execute(
            "UPDATE outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?",
            (attempts, next_attempt_at, error[:2000], row_id),
        )
        self.connection.commit()

    def pending_count(self) -> int:
        row = self.connection.execute("SELECT count(*) AS total FROM outbox").fetchone()
        return int(row["total"] if row else 0)

    def close(self) -> None:
        self.connection.close()
