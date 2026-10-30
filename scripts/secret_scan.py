"""Best-effort secret scan shared by the agent-ops helpers.

Path allowlisting remains the primary control. This is an extra check, not a
guarantee that arbitrary text contains no secrets or PII. Never feed
production data or credentials to these helpers.
"""
from __future__ import annotations
import re


class SensitiveContentError(RuntimeError):
    """Raised instead of echoing a detected secret."""


PATTERNS = (
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    r"\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{25,}|AKIA[A-Z0-9]{16})\b",
    r"(?i)(?:authorization\s*[:=]\s*[\"']?\s*bearer\s+)[A-Za-z0-9._-]{12,}",
    r"(?i)(?:api[_-]?key|appsecret|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*[\"'][A-Za-z0-9_./+=-]{16,}[\"']",
)


def reject_secrets(text: str) -> None:
    if any(re.search(p, text) for p in PATTERNS):
        raise SensitiveContentError("SENSITIVE_CONTENT_BLOCKED; remove the secret, not the check")
