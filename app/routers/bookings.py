from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..models import Booking, BookingStatus, Farm, Job, JobStatus, Role, User
from ..security import current_user, require_role
from ..services import create_notification, record_audit

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.get("/mine", response_model=list[schemas.BookingOut])
def my_bookings(user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Booking).order_by(Booking.created_at.desc())
    if user.role == Role.FARMER.value:
        q = q.join(Job).join(Farm).where(Farm.owner_id == user.id)
    elif user.role == Role.HYBRID.value:
        q = q.outerjoin(Job).outerjoin(Farm).where((Farm.owner_id == user.id) | (Booking.worker_id == user.id))
    else:
        q = q.where(Booking.worker_id == user.id)
    return [schemas.booking_out(b) for b in db.scalars(q)]


@router.post("/{booking_id}/complete", response_model=schemas.BookingOut)
def complete_booking(booking_id: int, user: User = Depends(require_role(Role.FARMER.value, Role.HYBRID.value)),
                     db: Session = Depends(get_db)):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    job = booking.job
    if job.farm.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This job belongs to another farmer")
    if booking.status != BookingStatus.CONFIRMED.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "Booking is already completed")
    booking.status = BookingStatus.COMPLETED.value
    booking.completed_at = datetime.now(timezone.utc)
    db.flush()

    create_notification(
        db,
        user_id=booking.worker_id,
        title="Work Marked Completed",
        message=f"Work on '{job.work_type}' has been marked completed. You can now leave a review!",
        type="REVIEW_REQUEST",
        link="/reviews",
    )
    create_notification(
        db,
        user_id=user.id,
        title="Booking Completed",
        message=f"Booking for {booking.worker.name} completed. Please leave a rating!",
        type="REVIEW_REQUEST",
        link="/reviews",
    )
    record_audit(
        db,
        user_id=user.id,
        action="COMPLETE_BOOKING",
        resource=f"booking:{booking.id}",
        details=f"Farmer {user.id} completed booking {booking.id} for worker {booking.worker_id}",
    )

    remaining = db.scalar(select(func.count(Booking.id)).where(
        Booking.job_id == job.id, Booking.status == BookingStatus.CONFIRMED.value))
    if job.status == JobStatus.FILLED.value and remaining == 0:
        job.status = JobStatus.COMPLETED.value
    db.commit()
    return schemas.booking_out(booking)
