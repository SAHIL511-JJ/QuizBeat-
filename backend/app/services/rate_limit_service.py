import threading
import time
from collections import defaultdict, deque


class RateLimitExceededError(RuntimeError):
    """Raised when a caller exceeds a configured in-memory rate limit."""


_requests: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def check_rate_limit(bucket: str, key: str, limit: int, window_seconds: int) -> None:
    if not key:
        key = "anonymous"

    now = time.time()
    bucket_key = f"{bucket}:{key}"

    with _lock:
        attempts = _requests[bucket_key]
        cutoff = now - window_seconds

        while attempts and attempts[0] <= cutoff:
            attempts.popleft()

        if len(attempts) >= limit:
            raise RateLimitExceededError(
                f"Too many requests for {bucket}. Please wait and try again."
            )

        attempts.append(now)
