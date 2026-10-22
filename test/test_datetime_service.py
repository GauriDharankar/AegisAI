from datetime import datetime, timedelta, timezone

from app.services.datetime_service import serialize_utc_datetime


def test_serialize_utc_datetime_treats_sqlite_naive_values_as_utc():
    stored_utc_value = datetime(2026, 10, 16, 18, 21, 37, 117894)

    assert serialize_utc_datetime(stored_utc_value) == "2026-10-16T18:21:37.117894+00:00"


def test_serialize_utc_datetime_normalizes_aware_values_to_utc():
    ist_value = datetime(2026, 10, 17, 0, 0, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))

    assert serialize_utc_datetime(ist_value) == "2026-10-16T18:30:00+00:00"


def test_serialize_utc_datetime_preserves_missing_values():
    assert serialize_utc_datetime(None) is None
