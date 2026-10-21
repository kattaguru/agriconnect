from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import current_user, require_role
from ..services import record_audit

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = require_role(models.Role.ADMIN.value)


@router.get("/metrics", response_model=schemas.AdminMetricsOut)
def get_platform_metrics(_: models.User = Depends(admin_only), db: Session = Depends(get_db)):
    total_users = db.scalar(select(func.count(models.User.id))) or 0
    total_farmers = db.scalar(select(func.count(models.User.id)).where(models.User.role == models.Role.FARMER.value)) or 0
    total_workers = db.scalar(select(func.count(models.User.id)).where(models.User.role == models.Role.WORKER.value)) or 0

    total_jobs = db.scalar(select(func.count(models.Job.id))) or 0
    open_jobs = db.scalar(select(func.count(models.Job.id)).where(models.Job.status == models.JobStatus.OPEN.value)) or 0
    filled_jobs = db.scalar(select(func.count(models.Job.id)).where(models.Job.status == models.JobStatus.FILLED.value)) or 0
    completed_jobs = db.scalar(select(func.count(models.Job.id)).where(models.Job.status == models.JobStatus.COMPLETED.value)) or 0

    total_bookings = db.scalar(select(func.count(models.Booking.id))) or 0
    completed_bookings = db.scalar(select(func.count(models.Booking.id)).where(models.Booking.status == models.BookingStatus.COMPLETED.value)) or 0

    total_reviews = db.scalar(select(func.count(models.Review.id))) or 0
    avg_rating = db.scalar(select(func.avg(models.Review.rating)))

    total_scans = db.scalar(select(func.count(models.CropScanHistory.id))) or 0
    total_simulations = db.scalar(select(func.count(models.ProfitSimulation.id))) or 0

    return schemas.AdminMetricsOut(
        total_users=total_users,
        total_farmers=total_farmers,
        total_workers=total_workers,
        total_jobs=total_jobs,
        open_jobs=open_jobs,
        filled_jobs=filled_jobs,
        completed_jobs=completed_jobs,
        total_bookings=total_bookings,
        completed_bookings=completed_bookings,
        total_reviews=total_reviews,
        avg_platform_rating=round(float(avg_rating), 2) if avg_rating is not None else None,
        total_scans=total_scans,
        total_simulations=total_simulations,
    )


@router.get("/users", response_model=list[schemas.UserAdminOut])
def list_users(_: models.User = Depends(admin_only), db: Session = Depends(get_db)):
    return db.scalars(select(models.User).order_by(models.User.created_at.desc())).all()


@router.post("/users/{user_id}/suspend", response_model=schemas.UserAdminOut)
def toggle_suspend_user(
    user_id: int,
    admin: models.User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    target = db.get(models.User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Administrators cannot suspend their own account")

    target.is_active = not target.is_active
    action = "SUSPEND_USER" if not target.is_active else "ACTIVATE_USER"
    record_audit(
        db,
        user_id=admin.id,
        action=action,
        resource=f"user:{target.id}",
        details=f"Admin {admin.email} set active={target.is_active} for {target.email}",
    )
    db.commit()
    return target


@router.get("/audit-logs", response_model=list[schemas.AuditLogOut])
def list_audit_logs(_: models.User = Depends(admin_only), db: Session = Depends(get_db)):
    return db.scalars(select(models.AuditLog).order_by(models.AuditLog.created_at.desc()).limit(100)).all()
