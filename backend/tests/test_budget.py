from datetime import datetime, timezone

from app.budget import Budget


def _clock(box):
    return lambda: box[0]


def test_increment_counts_calls(tmp_path):
    b = Budget(str(tmp_path / "b.db"), soft_limit=10)
    assert b.count_today() == 0
    b.increment()
    b.increment()
    assert b.count_today() == 2


def test_exhausted_at_soft_limit(tmp_path):
    b = Budget(str(tmp_path / "b.db"), soft_limit=2)
    b.increment()
    assert not b.exhausted()
    b.increment()
    assert b.exhausted()


def test_rolls_over_at_ist_midnight(tmp_path):
    box = [datetime(2026, 10, 31, 18, 29, tzinfo=timezone.utc)]
    b = Budget(str(tmp_path / "b.db"), soft_limit=5, now=_clock(box))
    b.increment()
    assert b.count_today() == 1
    box[0] = datetime(2026, 10, 31, 18, 31, tzinfo=timezone.utc)
    assert b.count_today() == 0
