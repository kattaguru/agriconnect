import pytest

from app.matching import score


def test_perfect_worker_scores_one():
    assert score(0.0, True, True, 10, 5.0) == pytest.approx(1.0)


def test_closer_skilled_worker_beats_far_unskilled_worker():
    assert score(2.0, True, True, 5, 4.5) > score(40.0, True, False, 0, None)


def test_worker_beyond_max_distance_gets_no_distance_points():
    assert score(500.0, False, False, 0, 0.0) == pytest.approx(0.0)


def test_unrated_worker_gets_neutral_reputation():
    assert score(None, False, False, 0, None) == pytest.approx(0.05)
