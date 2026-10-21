from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[schemas.NotificationOut])
def get_notifications(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Notification)
        .where(models.Notification.user_id == user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(50)
    ).all()


@router.get("/unread-count")
def get_unread_count(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    count = db.scalar(
        select(func.count(models.Notification.id))
        .where(models.Notification.user_id == user.id, models.Notification.is_read == False)
    ) or 0
    return {"unread_count": count}


@router.patch("/{notif_id}/read", response_model=schemas.NotificationOut)
def mark_read(notif_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    notif = db.get(models.Notification, notif_id)
    if notif is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if notif.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your notification")
    notif.is_read = True
    db.commit()
    return notif


@router.post("/read-all")
def mark_all_read(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    notifs = db.scalars(
        select(models.Notification)
        .where(models.Notification.user_id == user.id, models.Notification.is_read == False)
    ).all()
    for n in notifs:
        n.is_read = True
    db.commit()
    return {"status": "all_marked_read", "updated_count": len(notifs)}
