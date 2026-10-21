from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import matching, schemas
from ..database import get_db
from ..models import Review, Role, User, WorkerProfile
from ..security import current_user, require_role

router = APIRouter(prefix="/api/workers", tags=["workers"])
worker_only = require_role(Role.WORKER.value, Role.HYBRID.value)


def _profile(db: Session, user_id: int) -> WorkerProfile:
    p = db.scalar(select(WorkerProfile).where(WorkerProfile.user_id == user_id))
    if p is None:
        user = db.get(User, user_id)
        if user and user.role in (Role.WORKER.value, Role.HYBRID.value):
            p = WorkerProfile(user_id=user.id, skills=[])
            db.add(p)
            db.commit()
            return p
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Worker not found")
    return p


def _out(db: Session, p: WorkerProfile) -> schemas.WorkerOut:
    avg = matching.avg_rating(db, p.user_id)
    count = db.scalar(select(func.count(Review.id)).where(Review.reviewed_id == p.user_id))
    return schemas.WorkerOut(
        id=p.user_id, name=p.user.name, skills=list(p.skills), experience_years=p.experience_years,
        latitude=p.latitude, longitude=p.longitude, available=p.available,
        avg_rating=None if avg is None else round(avg, 2), review_count=count)


@router.get("/me", response_model=schemas.WorkerOut)
def my_profile(user: User = Depends(worker_only), db: Session = Depends(get_db)):
    return _out(db, _profile(db, user.id))


@router.put("/me", response_model=schemas.WorkerOut)
def update_profile(body: schemas.WorkerProfileRequest, user: User = Depends(worker_only),
                   db: Session = Depends(get_db)):
    p = _profile(db, user.id)
    p.skills = [s.strip() for s in body.skills if s.strip()]  # reassign so the JSON change is tracked
    p.experience_years = body.experience_years
    p.latitude = body.latitude
    p.longitude = body.longitude
    p.available = body.available
    db.commit()
    return _out(db, p)


@router.get("/{user_id}", response_model=schemas.WorkerOut)
def get_worker(user_id: int, _: User = Depends(current_user), db: Session = Depends(get_db)):
    return _out(db, _profile(db, user_id))
