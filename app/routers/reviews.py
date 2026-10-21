from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..models import Booking, BookingStatus, Review, User
from ..security import current_user
from ..services import create_notification, record_audit

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


@router.post("", response_model=schemas.ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(body: schemas.ReviewRequest, user: User = Depends(current_user),
                  db: Session = Depends(get_db)):
    booking = db.get(Booking, body.booking_id)
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    if booking.status != BookingStatus.COMPLETED.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can review only after the work is completed")
    farmer_id = booking.job.farm.owner_id
    if user.id == farmer_id:
        reviewed_id = booking.worker_id
    elif user.id == booking.worker_id:
        reviewed_id = farmer_id
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You were not part of this booking")
    if db.scalar(select(Review).where(Review.booking_id == booking.id, Review.reviewer_id == user.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "You already reviewed this booking")
    review = Review(booking_id=booking.id, reviewer_id=user.id, reviewed_id=reviewed_id,
                    rating=body.rating, comment=body.comment)
    db.add(review)
    db.flush()

    record_audit(
        db,
        user_id=user.id,
        action="CREATE_REVIEW",
        resource=f"review:{review.id}",
        details=f"User {user.id} gave rating {body.rating} to user {reviewed_id} for booking {booking.id}",
    )
    create_notification(
        db,
        user_id=reviewed_id,
        title="New Review Received",
        message=f"You received a {body.rating}-star review for booking #{booking.id}.",
        type="REVIEW",
        link="/reviews",
    )

    db.commit()
    return review
