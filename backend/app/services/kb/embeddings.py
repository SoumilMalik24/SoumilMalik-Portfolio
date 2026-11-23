"""Text embedding clients: Hugging Face inference API, or a deterministic fake for tests/dev (spec 9.1)."""
import hashlib
import logging
import math
import re
import time
from typing import List, Protocol

import requests

from app.config import get_settings

logger = logging.getLogger(__name__)

DIMS = 384
BATCH_SIZE = 32
RETRY_DELAYS_S = (1.0, 3.0)


class EmbeddingError(Exception):
    """Raised when embeddings cannot be computed."""


class Embedder(Protocol):
    model_id: str

    def embed(self, texts: List[str]) -> List[List[float]]:
        """Return one L2-normalized vector per input text."""


def normalize(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    return [v / norm for v in vec] if norm else vec


class HFEmbedder:
    model_id = "all-MiniLM-L6-v2"

    def __init__(self, url: str, token: str):
        if not token:
            raise EmbeddingError("HUGGINGFACE_API_TOKEN is not set")
        self.url = url
        self.headers = {"Authorization": f"Bearer {token}"}

    def _post(self, batch: List[str]) -> List[List[float]]:
        last_error = "unknown error"
        for attempt in range(len(RETRY_DELAYS_S) + 1):
            try:
                resp = requests.post(self.url, json={"inputs": batch}, headers=self.headers, timeout=30)
            except requests.RequestException as exc:
                last_error = str(exc)
            else:
                if resp.status_code == 200:
                    return self._parse(resp.json(), len(batch))
                last_error = f"HTTP {resp.status_code}"
                if resp.status_code not in (429, 500, 502, 503, 504):
                    break
            if attempt < len(RETRY_DELAYS_S):
                time.sleep(RETRY_DELAYS_S[attempt])
        raise EmbeddingError(f"Embedding request failed: {last_error}")

    @staticmethod
    def _parse(data: object, expected: int) -> List[List[float]]:
        if not isinstance(data, list) or len(data) != expected:
            raise EmbeddingError("Unexpected embedding response shape")
        vectors = []
        for row in data:
            # Some deployments return token-level vectors ([tokens][dims]); mean-pool them.
            if row and isinstance(row[0], list):
                row = [sum(col) / len(row) for col in zip(*row)]
            vectors.append(normalize([float(v) for v in row]))
        return vectors

    def embed(self, texts: List[str]) -> List[List[float]]:
        out: List[List[float]] = []
        for i in range(0, len(texts), BATCH_SIZE):
            out.extend(self._post(texts[i:i + BATCH_SIZE]))
        return out


class OpenRouterEmbedder:
    """OpenAI-compatible /embeddings endpoint on OpenRouter. Must return DIMS-dimensional vectors."""
    model_id = "all-MiniLM-L6-v2"  # same underlying model as HFEmbedder, so existing indexes stay valid

    def __init__(self, url: str, key: str, model: str):
        if not key:
            raise EmbeddingError("OPENROUTER_API_KEY is not set")
        self.url = url
        self.model = model
        self.headers = {"Authorization": f"Bearer {key}"}

    def _post(self, batch: List[str]) -> List[List[float]]:
        last_error = "unknown error"
        for attempt in range(len(RETRY_DELAYS_S) + 1):
            try:
                resp = requests.post(
                    self.url, json={"model": self.model, "input": batch}, headers=self.headers, timeout=30
                )
            except requests.RequestException as exc:
                last_error = str(exc)
            else:
                if resp.status_code == 200:
                    return self._parse(resp.json(), len(batch))
                last_error = f"HTTP {resp.status_code}"
                if resp.status_code not in (429, 500, 502, 503, 504):
                    break
            if attempt < len(RETRY_DELAYS_S):
                time.sleep(RETRY_DELAYS_S[attempt])
        raise EmbeddingError(f"Embedding request failed: {last_error}")

    @staticmethod
    def _parse(data: object, expected: int) -> List[List[float]]:
        rows = data.get("data") if isinstance(data, dict) else None
        if not isinstance(rows, list) or len(rows) != expected:
            raise EmbeddingError("Unexpected embedding response shape")
        rows = sorted(rows, key=lambda r: r.get("index", 0))
        vectors = []
        for row in rows:
            vec = row.get("embedding")
            if not isinstance(vec, list) or len(vec) != DIMS:
                raise EmbeddingError(f"Embedding model must return {DIMS} dimensions")
            vectors.append(normalize([float(v) for v in vec]))
        return vectors

    def embed(self, texts: List[str]) -> List[List[float]]:
        out: List[List[float]] = []
        for i in range(0, len(texts), BATCH_SIZE):
            out.extend(self._post(texts[i:i + BATCH_SIZE]))
        return out


class FakeEmbedder:
    """Bag-of-words hashing embedder: deterministic, offline, and texts sharing words score higher."""
    model_id = "fake-384"

    def embed(self, texts: List[str]) -> List[List[float]]:
        vectors = []
        for text in texts:
            vec = [0.0] * DIMS
            for word in re.findall(r"[a-z0-9]+", text.lower()):
                h = int.from_bytes(hashlib.sha256(word.encode()).digest()[:4], "big")
                vec[h % DIMS] += 1.0 if (h >> 31) & 1 else -1.0
            if not any(vec):
                vec[0] = 1.0
            vectors.append(normalize(vec))
        return vectors


def get_embedder() -> Embedder:
    s = get_settings()
    if s.EMBEDDINGS_PROVIDER == "fake":
        return FakeEmbedder()
    if s.EMBEDDINGS_PROVIDER == "hf":
        return HFEmbedder(s.HF_EMBEDDINGS_URL, s.HUGGINGFACE_API_TOKEN)
    return OpenRouterEmbedder(s.OPENROUTER_EMBEDDINGS_URL, s.OPENROUTER_API_KEY, s.OPENROUTER_EMBEDDINGS_MODEL)
