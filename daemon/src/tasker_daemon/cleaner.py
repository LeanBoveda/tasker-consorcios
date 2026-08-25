from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import re


class _TextExtractor(HTMLParser):
    BLOCK_TAGS = {"br", "p", "div", "li", "tr", "h1", "h2", "h3", "blockquote"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.hidden_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"style", "script", "head"}:
            self.hidden_depth += 1
        elif not self.hidden_depth and tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"style", "script", "head"} and self.hidden_depth:
            self.hidden_depth -= 1
        elif not self.hidden_depth and tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.hidden_depth:
            self.parts.append(data)


def html_to_text(value: str) -> str:
    parser = _TextExtractor()
    parser.feed(value)
    return unescape("".join(parser.parts))


def clean_subject(subject: str) -> str:
    value = re.sub(r"^\s*((re|rv|fwd?|enc)\s*:\s*)+", "", subject, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip(" -\t")
    return value[:500] or "Correo sin asunto"


def clean_email_body(body: str) -> str:
    value = body.replace("\r\n", "\n").replace("\r", "\n").replace("\u00a0", " ")
    value = re.sub(r"(?is)<(?:html|body|div|p|br|table|span|blockquote)\b", lambda match: match.group(0), value)
    if re.search(r"(?is)<(?:html|body|div|p|br|table)\b", value):
        value = html_to_text(value)

    lines = value.split("\n")
    cleaned: list[str] = []
    skipping_forward_headers = False
    for raw_line in lines:
        line = raw_line.strip()
        lowered = _normalize(line)
        if not line:
            if cleaned and cleaned[-1] != "":
                cleaned.append("")
            continue
        if re.match(r"^-{2,}\s*(forwarded message|mensaje reenviado)\s*-{2,}$", line, re.IGNORECASE):
            skipping_forward_headers = True
            continue
        if skipping_forward_headers:
            if re.match(r"^(de|from|date|fecha|enviado|sent|subject|asunto|to|para|cc)\s*:", line, re.IGNORECASE):
                continue
            skipping_forward_headers = False
        if re.match(r"^correo recibido de\b", lowered):
            continue
        if re.match(r"^(on .+ wrote:|el .+ escribio:)$", lowered):
            break
        if line.startswith(">"):
            continue
        if _starts_signature_or_disclaimer(lowered, line):
            break
        cleaned.append(line)

    result = "\n".join(cleaned)
    result = re.sub(r"\n{3,}", "\n\n", result)
    result = re.sub(r"[ \t]+", " ", result)
    return result.strip()[:20000]


def _starts_signature_or_disclaimer(normalized: str, original: str) -> bool:
    if original in {"--", "___", "_____"} or re.match(r"^--\s*$", original):
        return True
    markers = (
        "este mensaje es confidencial",
        "aviso de confidencialidad",
        "aviso legal",
        "confidentiality notice",
        "this message is confidential",
        "la informacion contenida en este correo",
    )
    return any(normalized.startswith(marker) for marker in markers)


def _normalize(value: str) -> str:
    replacements = str.maketrans("áéíóúüñ", "aeiouun")
    return value.lower().translate(replacements).strip()
