"""Network and IP extraction utilities."""
import hashlib
import hmac
from typing import Optional
from fastapi import Request

from app.config import get_settings


def client_ip(request: Request) -> str:
    """
    Extract real client IP address safely.
    Proxies like Render/Cloudflare/Nginx append client IP to X-Forwarded-For;
    the right-most entry is verified by the immediate upstream reverse-proxy.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-1]
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def ip_hash(ip: Optional[str]) -> Optional[str]:
    """Compute a salted sha256 hash of an IP address using SECRET_KEY."""
    if not ip:
        return None
    settings = get_settings()
    salt = (settings.SECRET_KEY or "dev-secret-salt").encode("utf-8")
    return hmac.new(salt, ip.encode("utf-8"), hashlib.sha256).hexdigest()
