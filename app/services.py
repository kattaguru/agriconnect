from sqlalchemy.orm import Session
from . import models


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: str = "INFO",
    link: str | None = None,
) -> models.Notification:
    notif = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        link=link,
        is_read=False,
    )
    db.add(notif)
    return notif


def record_audit(
    db: Session,
    user_id: int | None,
    action: str,
    resource: str,
    details: str | None = None,
) -> models.AuditLog:
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        details=details,
    )
    db.add(log)
    return log
