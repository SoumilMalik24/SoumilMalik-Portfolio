"""Thread-safe, bounded sliding-window rate limiters."""
import math
import threading
import time
from collections import defaultdict, deque
from typing import Tuple


class SlidingWindowLimiter:
    """Thread-safe, bounded in-memory sliding-window rate limiter."""

    def __init__(self, max_requests: int, window_seconds: float, max_keys: int = 5000):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self.lock = threading.Lock()
        self.history: dict[str, deque[float]] = defaultdict(deque)

    def check_and_record(self, key: str) -> Tuple[bool, int]:
        """
        Check if an attempt is allowed.
        If allowed, records it and returns (True, 0).
        If rejected, returns (False, retry_after_seconds).
        """
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self.lock:
            self._prune(cutoff)
            dq = self.history[key]
            while dq and dq[0] < cutoff:
                dq.popleft()

            if len(dq) >= self.max_requests:
                oldest = dq[0]
                retry_after = max(1, int(math.ceil(oldest + self.window_seconds - now)))
                return False, retry_after

            dq.append(now)
            return True, 0

    def is_limited(self, key: str) -> Tuple[bool, int]:
        """Check if limited without recording a new attempt."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self.lock:
            dq = self.history.get(key)
            if not dq:
                return False, 0
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= self.max_requests:
                oldest = dq[0]
                retry_after = max(1, int(math.ceil(oldest + self.window_seconds - now)))
                return True, retry_after
            return False, 0

    def record(self, key: str) -> None:
        """Record an event unconditionally."""
        now = time.monotonic()
        with self.lock:
            self._prune(now - self.window_seconds)
            self.history[key].append(now)

    def _prune(self, cutoff: float) -> None:
        """Drop keys with no events inside the window once too many keys are tracked (caller holds lock)."""
        if len(self.history) > self.max_keys:
            for k in [k for k, v in self.history.items() if not v or v[-1] < cutoff]:
                del self.history[k]

    def reset(self, key: str) -> None:
        """Reset history for a key."""
        with self.lock:
            self.history.pop(key, None)

    def clear(self) -> None:
        """Clear all stored state."""
        with self.lock:
            self.history.clear()


# IP-based login failure limiter: 10 failed attempts per IP per 15 min (900 seconds)
login_ip_failure_limiter = SlidingWindowLimiter(max_requests=10, window_seconds=900.0)

# Password forgot limiter: 3/hour (3600 seconds) per IP and per email
forgot_pw_ip_limiter = SlidingWindowLimiter(max_requests=3, window_seconds=3600.0)
forgot_pw_email_limiter = SlidingWindowLimiter(max_requests=3, window_seconds=3600.0)

# Telemetry ingest limiter: 120 per 600s
track_throttle_limiter = SlidingWindowLimiter(max_requests=120, window_seconds=600.0)
