import sqlite3
from datetime import datetime, timedelta, timezone

from app.cache import Cache


class Clock:
    def __init__(self):
        self.t = datetime(2026, 1, 1, tzinfo=timezone.utc)

    def __call__(self):
        return self.t

    def advance(self, s):
        self.t += timedelta(seconds=s)


def make(tmp_path):
    clock = Clock()
    return Cache(str(tmp_path / "sub" / "c.db"), now=clock), clock


def test_get_returns_none_for_missing(tmp_path):
    cache, _ = make(tmp_path)
    assert cache.get("x") is None


def test_fresh_entry_is_fresh(tmp_path):
    cache, clock = make(tmp_path)
    cache.set("k", {"a": 1}, 10)
    e = cache.get("k")
    assert e.payload == {"a": 1}
    assert e.is_fresh(clock())


def test_expired_entry_still_returned_but_not_fresh(tmp_path):
    cache, clock = make(tmp_path)
    cache.set("k", {"a": 1}, 10)
    clock.advance(11)
    e = cache.get("k")
    assert e is not None
    assert not e.is_fresh(clock())


def test_purge_removes_rows_older_than_retention(tmp_path):
    cache, clock = make(tmp_path)
    cache.set("k", {"a": 1}, 10)
    clock.advance(10 + 100 + 1)
    assert cache.purge(100) == 1
    assert cache.get("k") is None


def test_corrupt_payload_returns_none(tmp_path):
    cache, _ = make(tmp_path)
    cache.set("k", {"a": 1}, 10)
    conn = sqlite3.connect(str(tmp_path / "sub" / "c.db"))
    conn.execute("UPDATE cache SET payload='{bad'")
    conn.commit()
    conn.close()
    assert cache.get("k") is None


def test_naive_timestamp_returns_none(tmp_path):
    cache, _ = make(tmp_path)
    cache.set("k", {"a": 1}, 10)
    conn = sqlite3.connect(str(tmp_path / "sub" / "c.db"))
    conn.execute("UPDATE cache SET expires_at='2026-01-01T00:00:00'")
    conn.commit()
    conn.close()
    assert cache.get("k") is None


def test_purge_defaults_to_cache_retention(tmp_path):
    clock = Clock()
    cache = Cache(str(tmp_path / "c.db"), now=clock, retention_seconds=100)
    cache.set("k", {"a": 1}, 10)
    clock.advance(10 + 101)
    assert cache.purge() == 1
