"""Vercel deploy hook trigger and optional build-status lookup (spec 7.5)."""
from typing import Optional

import requests

from app.config import get_settings

VERCEL_DEPLOYMENTS_URL = "https://api.vercel.com/v6/deployments"

# Vercel deployment state -> our deploy_status
_STATE_MAP = {
    "READY": "ready",
    "ERROR": "failed",
    "CANCELED": "failed",
    "QUEUED": "building",
    "INITIALIZING": "building",
    "BUILDING": "building",
}


class DeployHookError(Exception):
    """Raised when the deploy hook or Vercel API call fails."""


def hook_configured() -> bool:
    return bool(get_settings().VERCEL_DEPLOY_HOOK_URL)


def polling_configured() -> bool:
    s = get_settings()
    return bool(s.VERCEL_TOKEN and s.VERCEL_PROJECT_ID)


def trigger() -> Optional[str]:
    """POST the deploy hook. Returns the Vercel job id when present."""
    url = get_settings().VERCEL_DEPLOY_HOOK_URL
    try:
        resp = requests.post(url, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise DeployHookError(f"Deploy hook failed: {exc}") from exc
    try:
        job = resp.json().get("job") or {}
        return str(job["id"]) if job.get("id") else None
    except (ValueError, AttributeError):
        return None


def latest_status(since_ms: int) -> Optional[str]:
    """Return our status for the newest deployment created since `since_ms`, or None if none yet."""
    s = get_settings()
    try:
        resp = requests.get(
            VERCEL_DEPLOYMENTS_URL,
            params={"projectId": s.VERCEL_PROJECT_ID, "limit": 1, "since": since_ms},
            headers={"Authorization": f"Bearer {s.VERCEL_TOKEN}"},
            timeout=10,
        )
        resp.raise_for_status()
        deployments = resp.json().get("deployments") or []
    except (requests.RequestException, ValueError) as exc:
        raise DeployHookError(f"Vercel status check failed: {exc}") from exc
    if not deployments:
        return None
    state = deployments[0].get("state") or deployments[0].get("readyState")
    return _STATE_MAP.get(str(state).upper())
