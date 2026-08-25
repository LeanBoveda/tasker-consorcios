from __future__ import annotations

import re
import unicodedata


def normalized(value: str) -> str:
    text = unicodedata.normalize("NFD", value.lower())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def classify_kind(subject: str, body: str) -> str:
    text = normalized(f"{subject} {body}")
    if re.search(r"\b(reclamo|queja|problema|falla|rotura|perdida|filtracion|urgente)\b", text):
        return "claim"
    if re.search(r"\b(solicitud|solicito|necesito|consulta|informacion|libre deuda)\b", text):
        return "request"
    if re.search(r"\b(pedido|presupuesto|comprar|compra|enviar|envio|factura)\b", text):
        return "order"
    if re.search(r"\b(aviso|informa|notifica|comunica|vencimiento)\b", text):
        return "notice"
    return "other"


def classify_priority(subject: str, body: str) -> str:
    text = normalized(f"{subject} {body}")
    if re.search(r"\b(urgente|persona atrapada|olor a gas|incendio|humo|inundacion|sin agua|sin luz|cortocircuito)\b", text):
        return "high"
    if re.search(r"\b(consulta|cuando puedan|sin apuro)\b", text):
        return "low"
    return "medium"


def classify_follow_up(subject: str, body: str) -> str:
    text = normalized(f"{subject} {body}")
    if re.search(r"\b(sigue|continua|persiste|volvio|nuevamente|otra vez|no se resolvio|no se soluciono|todavia|aun)\b", text):
        return "recurrence"
    if re.search(r"\b(ya esta solucionado|ya quedo solucionado|ya esta resuelto|ya quedo resuelto|se soluciono|problema resuelto)\b", text):
        return "resolved"
    if re.fullmatch(r"(muchas )?gracias[.! ]*", text):
        return "resolved"
    return "unknown"


def is_noise(labels: set[str], subject: str, headers: dict[str, str]) -> bool:
    if labels.intersection({"SPAM", "TRASH", "DRAFT", "SENT", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL"}):
        return True
    text = normalized(subject)
    list_mail = bool(headers.get("list-unsubscribe") or headers.get("list-id"))
    promotional = re.search(r"\b(oferta|promocion|descuento|newsletter|novedades|marketing)\b", text)
    return bool(list_mail and promotional)
