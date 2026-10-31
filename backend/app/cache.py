import json
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from app.db import connect


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class CacheEntry:
    payload: dict
    fetched_at: datetime
    expires_at: datetime

    def is_fresh(self, now: datetime) -> bool:
        return now < self.expires_at


class Cache:
    def __init__(
        self,
        path: str,
        now: Callable[[], datetime] = utcnow,
        retention_seconds: int = 24 * 3600,
    ):
        self._now = now
        self._retention = timedelta(seconds=retention_seconds)
        self._lock = threading.Lock()
        self._conn = connect(path)
        with self._lock:
            self._conn.execute(
                "CREATE TABLE IF NOT EXISTS cache("
                "key TEXT PRIMARY KEY, payload TEXT, "
                "fetched_at TEXT, expires_at TEXT)"
            )
            self._conn.commit()

    def get(self, key: str) -> Optional[CacheEntry]:
        try:
            with self._lock:
                row = self._conn.execute(
                    "SELECT payload, fetched_at, expires_at FROM cache WHERE key=?",
                    (key,),
                ).fetchone()
            if row is None:
                return None
            entry = CacheEntry(
                payload=json.loads(row[0]),
                fetched_at=datetime.fromisoformat(row[1]),
                expires_at=datetime.fromisoformat(row[2]),
            )
            if not isinstance(entry.payload, dict):
                return None
            if entry.fetched_at.tzinfo is None or entry.expires_at.tzinfo is None:
                return None
            if self._now() > entry.expires_at + self._retention:
                return None
        except Exception:
            return None
        return entry

    def set(self, key: str, payload: dict, ttl_seconds: int) -> None:
        now = self._now()
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO cache(key, payload, fetched_at, expires_at) "
                "VALUES (?,?,?,?)",
                (
                    key,
                    json.dumps(payload),
                    now.isoformat(),
                    (now + timedelta(seconds=ttl_seconds)).isoformat(),
                ),
            )
            self._conn.commit()

    def purge(self, retention_seconds: Optional[int] = None) -> int:
        retention = (
            self._retention
            if retention_seconds is None
            else timedelta(seconds=retention_seconds)
        )
        cutoff = (self._now() - retention).isoformat()
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM cache WHERE expires_at < ?", (cutoff,)
            )
            self._conn.commit()
            return cur.rowcount
