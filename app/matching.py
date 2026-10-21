"""Transparent rule-based worker ranking (blueprint section 12).

distance 40%, availability 20%, skill 20%, experience 10%, reputation 10%.
This is the baseline a future ML ranking model should be evaluated against.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models
from .geo import distance_km

MAX_DISTANCE_KM = 50.0


def score(distance: float | None, available: bool, skill_match: bool,
          experience_years: int, avg_rating: float | None) -> float:
    d = 0.0 if distance is None else max(0.0, 1 - distance / MAX_DISTANCE_KM)
    e = min(max(experience_years, 0), 10) / 10
    r = 0.5 if avg_rating is None else avg_rating / 5  # unrated workers get a neutral score
    return 0.4 * d + 0.2 * (1 if available else 0) + 0.2 * (1 if skill_match else 0) + 0.1 * e + 0.1 * r


def avg_rating(db: Session, user_id: int) -> float | None:
    return db.scalar(select(func.avg(models.Review.rating)).where(models.Review.reviewed_id == user_id))


def rank_workers(db: Session, job: models.Job) -> list[dict]:
    farm = job.farm
    need = (job.required_skill or "").strip().lower()
    results = []
    for p in db.scalars(select(models.WorkerProfile)):
        # Never recommend the farm owner as a worker for their own job
        if p.user_id == farm.owner_id:
            continue
        if not getattr(p.user, "is_active", True):
            continue
        dist = None
        if p.latitude is not None and p.longitude is not None:
            dist = distance_km(farm.latitude, farm.longitude, p.latitude, p.longitude)
        skill = not need or need in [s.strip().lower() for s in p.skills]
        avg = avg_rating(db, p.user_id)
        s = score(dist, p.available, skill, p.experience_years, avg)
        reasons = []
        if dist is not None:
            reasons.append(f"{dist:.1f} km from the farm")
        reasons.append("has the required skill" if skill else "does not list the required skill")
        reasons.append("available" if p.available else "currently unavailable")
        reasons.append(f"{p.experience_years} years experience")
        reasons.append("no ratings yet" if avg is None else f"rated {avg:.1f}/5")
        results.append({"worker_id": p.user_id, "name": p.user.name, "score": round(s, 3),
                        "distance_km": None if dist is None else round(dist, 1), "reasons": reasons})
    results.sort(key=lambda m: m["score"], reverse=True)
    return results
