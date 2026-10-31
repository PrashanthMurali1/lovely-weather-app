import threading
from datetime import datetime
from typing import Callable
from zoneinfo import ZoneInfo

from app.cache import utcnow
from app.db import connect

IST = ZoneInfo("Asia/Kolkata")


class Budget:
    def __init__(
        self,
        path: str,
        soft_limit: int,
        now: Callable[[], datetime] = utcnow,
    ):
        self._soft_limit = soft_limit
        self._now = now
        self._lock = threading.Lock()
        self._conn = connect(path)
        with self._lock:
            self._conn.execute(
                "CREATE TABLE IF NOT EXISTS budget("
                "day TEXT PRIMARY KEY, calls INTEGER)"
            )
            self._conn.commit()

    def _day(self) -> str:
        return self._now().astimezone(IST).date().isoformat()

    def count_today(self) -> int:
        with self._lock:
            row = self._conn.execute(
                "SELECT calls FROM budget WHERE day=?", (self._day(),)
            ).fetchone()
        return row[0] if row else 0

    def increment(self) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO budget(day, calls) VALUES (?, 1) "
                "ON CONFLICT(day) DO UPDATE SET calls = calls + 1",
                (self._day(),),
            )
            self._conn.commit()

    def exhausted(self) -> bool:
        return self.count_today() >= self._soft_limit
