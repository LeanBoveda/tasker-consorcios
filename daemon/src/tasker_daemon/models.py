from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class IntakeEvent:
    source: str
    source_account: str
    external_id: str
    conversation_id: str | None
    sender_name: str
    sender_address: str
    title: str
    body: str
    kind: str
    priority: str
    received_at: int
    follow_up_signal: str = "unknown"
    attachments: list[dict[str, Any]] = field(default_factory=list)

    def as_payload(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "sourceAccount": self.source_account,
            "externalId": self.external_id,
            "conversationId": self.conversation_id,
            "senderName": self.sender_name,
            "senderAddress": self.sender_address,
            "title": self.title,
            "body": self.body,
            "kind": self.kind,
            "priority": self.priority,
            "receivedAt": self.received_at,
            "followUpSignal": self.follow_up_signal,
            "attachments": self.attachments,
        }


@dataclass(slots=True)
class PollBatch:
    events: list[IntakeEvent]
    next_history_id: str
