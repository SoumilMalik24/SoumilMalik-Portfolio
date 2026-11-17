"""OpenRouter chat-completions client."""
from typing import Any, Dict, List, Optional

import requests

from app.config import get_settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
TIMEOUT_S = 30


class LLMError(Exception):
    """Raised when the LLM call fails or returns an unusable response."""


def chat_completion(
    messages: List[Dict[str, Any]],
    model: str,
    tools: Optional[List[Dict[str, Any]]] = None,
    max_tokens: int = 250,
    temperature: float = 0.4,
) -> Dict[str, Any]:
    """Call OpenRouter and return the parsed JSON response."""
    settings = get_settings()
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "X-Title": "Portfolio Kirby",
    }
    try:
        resp = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=TIMEOUT_S)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        raise LLMError(str(exc)) from exc
    if not isinstance(data, dict) or not data.get("choices"):
        raise LLMError("Empty completion")
    return data
