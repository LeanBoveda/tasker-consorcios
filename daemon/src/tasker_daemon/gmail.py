from __future__ import annotations

from base64 import urlsafe_b64decode
from email.header import decode_header, make_header
from email.utils import getaddresses, parseaddr
import logging
from pathlib import Path
import time
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .classifier import classify_follow_up, classify_kind, classify_priority, is_noise
from .cleaner import clean_email_body, clean_subject, html_to_text
from .config import GmailSettings
from .models import IntakeEvent, PollBatch
from .state import StateStore


LOGGER = logging.getLogger(__name__)
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


class GmailConnector:
    def __init__(self, settings: GmailSettings, state: StateStore) -> None:
        self.settings = settings
        self.state = state
        self.service = None
        self.actual_account = settings.account

    @property
    def cursor_key(self) -> str:
        return f"gmail:{self.settings.account}:history_id"

    @property
    def last_success_key(self) -> str:
        return f"gmail:{self.settings.account}:last_success_epoch"

    def authorize(self, interactive: bool) -> str:
        credentials = self._load_credentials(interactive=interactive)
        service = build("gmail", "v1", credentials=credentials, cache_discovery=False)
        profile = service.users().getProfile(userId="me").execute()
        self.actual_account = str(profile.get("emailAddress", self.settings.account)).lower()
        if self.settings.account and self.actual_account != self.settings.account:
            raise RuntimeError(
                f"Se vinculó {self.actual_account}, pero la configuración indica {self.settings.account}. "
                "Volvé a autorizar con la casilla central correcta."
            )
        self.service = service
        return self.actual_account

    def poll(self) -> PollBatch:
        service = self._service()
        cursor = self.state.get(self.cursor_key)
        if not cursor:
            profile = service.users().getProfile(userId="me").execute()
            history_id = str(profile["historyId"])
            self.state.set(self.last_success_key, str(int(time.time())))
            LOGGER.info("Gmail activado desde este momento; no se importará historial anterior")
            return PollBatch(events=[], next_history_id=history_id)

        try:
            return self._poll_history(cursor)
        except HttpError as error:
            if getattr(error.resp, "status", None) != 404:
                raise
            LOGGER.warning("El cursor de Gmail venció; recuperando mensajes desde el último control")
            return self._poll_fallback()

    def commit(self, history_id: str) -> None:
        self.state.set(self.cursor_key, history_id)
        self.state.set(self.last_success_key, str(int(time.time())))

    def _poll_history(self, cursor: str) -> PollBatch:
        service = self._service()
        page_token: str | None = None
        message_ids: set[str] = set()
        next_history_id = cursor
        while True:
            response = service.users().history().list(
                userId="me",
                startHistoryId=cursor,
                historyTypes=["messageAdded"],
                labelId="INBOX",
                pageToken=page_token,
                maxResults=500,
            ).execute()
            next_history_id = str(response.get("historyId", next_history_id))
            for history in response.get("history", []):
                for item in history.get("messagesAdded", []):
                    message_id = str(item.get("message", {}).get("id", ""))
                    if message_id:
                        message_ids.add(message_id)
            page_token = response.get("nextPageToken")
            if not page_token:
                break
        return PollBatch(events=self._fetch_events(message_ids), next_history_id=next_history_id)

    def _poll_fallback(self) -> PollBatch:
        service = self._service()
        last_success = int(self.state.get(self.last_success_key) or int(time.time()))
        after = max(last_success - 300, int(time.time()) - 7 * 86400)
        query = f"{self.settings.query} after:{after}".strip()
        message_ids: set[str] = set()
        page_token: str | None = None
        while True:
            response = service.users().messages().list(
                userId="me", q=query, maxResults=500, pageToken=page_token
            ).execute()
            message_ids.update(str(item["id"]) for item in response.get("messages", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break
        profile = service.users().getProfile(userId="me").execute()
        return PollBatch(events=self._fetch_events(message_ids), next_history_id=str(profile["historyId"]))

    def _fetch_events(self, message_ids: set[str]) -> list[IntakeEvent]:
        events: list[IntakeEvent] = []
        service = self._service()
        for message_id in sorted(message_ids):
            message = service.users().messages().get(userId="me", id=message_id, format="full").execute()
            event = self._to_event(message)
            if event:
                events.append(event)
        return events

    def _to_event(self, message: dict[str, Any]) -> IntakeEvent | None:
        labels = {str(value) for value in message.get("labelIds", [])}
        payload = message.get("payload", {})
        headers = {
            str(item.get("name", "")).lower(): _decode_header(str(item.get("value", "")))
            for item in payload.get("headers", [])
        }
        raw_subject = headers.get("subject", "")
        if is_noise(labels, raw_subject, headers):
            LOGGER.info("Correo omitido por filtro: %s", raw_subject or "sin asunto")
            return None

        plain_parts: list[str] = []
        html_parts: list[str] = []
        attachments: list[dict[str, Any]] = []
        _collect_parts(payload, plain_parts, html_parts, attachments)
        raw_body = "\n".join(plain_parts) if plain_parts else html_to_text("\n".join(html_parts))
        body = clean_email_body(raw_body)
        title = clean_subject(raw_subject)
        if not body:
            body = str(message.get("snippet", "")).strip()
        sender_name, sender_address = parseaddr(headers.get("from", ""))
        sender_name = _decode_header(sender_name).strip() or sender_address or "Remitente sin nombre"
        source_account = _original_recipient(headers, self.settings.account)
        message_header_id = headers.get("message-id", "").strip().strip("<>")
        external_id = message_header_id or str(message.get("id", ""))
        received_at = int(message.get("internalDate", int(time.time() * 1000)))
        return IntakeEvent(
            source="email",
            source_account=source_account,
            external_id=external_id,
            conversation_id=str(message.get("threadId", "")) or None,
            sender_name=sender_name,
            sender_address=sender_address,
            title=title,
            body=body,
            kind=classify_kind(title, body),
            priority=classify_priority(title, body),
            follow_up_signal=classify_follow_up(title, body),
            received_at=received_at,
            attachments=attachments,
        )

    def _load_credentials(self, interactive: bool) -> Credentials:
        token_file = self.settings.token_file
        credentials: Credentials | None = None
        if token_file.exists():
            credentials = Credentials.from_authorized_user_file(str(token_file), SCOPES)
        if credentials and credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
        if not credentials or not credentials.valid:
            if not interactive:
                raise RuntimeError("Gmail no está autorizado. Ejecutá primero la configuración de Gmail.")
            if not self.settings.credentials_file.exists():
                raise RuntimeError(f"No se encontró el archivo de Google: {self.settings.credentials_file}")
            flow = InstalledAppFlow.from_client_secrets_file(str(self.settings.credentials_file), SCOPES)
            credentials = flow.run_local_server(port=0, prompt="consent")
        token_file.parent.mkdir(parents=True, exist_ok=True)
        token_file.write_text(credentials.to_json(), encoding="utf-8")
        return credentials

    def _service(self):
        if self.service is None:
            self.authorize(interactive=False)
        return self.service


def _collect_parts(
    payload: dict[str, Any], plain_parts: list[str], html_parts: list[str], attachments: list[dict[str, Any]]
) -> None:
    filename = str(payload.get("filename", "")).strip()
    mime_type = str(payload.get("mimeType", "application/octet-stream"))
    body = payload.get("body", {})
    if filename:
        attachments.append({
            "name": filename[:300],
            "contentType": mime_type[:150],
            "size": int(body.get("size", 0)) if body.get("size") is not None else None,
            "url": None,
        })
    data = body.get("data")
    if data and not filename:
        decoded = _decode_base64(str(data))
        if mime_type == "text/plain":
            plain_parts.append(decoded)
        elif mime_type == "text/html":
            html_parts.append(decoded)
    for part in payload.get("parts", []) or []:
        _collect_parts(part, plain_parts, html_parts, attachments)


def _decode_base64(value: str) -> str:
    padding = "=" * (-len(value) % 4)
    raw = urlsafe_b64decode(value + padding)
    return raw.decode("utf-8", errors="replace")


def _decode_header(value: str) -> str:
    try:
        return str(make_header(decode_header(value)))
    except (LookupError, UnicodeDecodeError):
        return value


def _original_recipient(headers: dict[str, str], central_account: str) -> str:
    candidates: list[str] = []
    for name in ("to", "x-original-to", "envelope-to", "delivered-to"):
        candidates.extend(address.lower() for _, address in getaddresses([headers.get(name, "")]) if address)
    for candidate in candidates:
        if candidate != central_account.lower():
            return candidate
    return central_account.lower()
