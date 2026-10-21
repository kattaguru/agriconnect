from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import matching, schemas
from ..database import get_db
from ..geo import distance_km
from ..models import (ApplicationStatus, Booking, BookingStatus, Farm, Job, JobApplication,
                      JobStatus, Role, User, WorkerProfile)
from ..security import current_user, require_role
from ..services import create_notification, record_audit

router = APIRouter(prefix="/api", tags=["jobs"])
farmer_only = require_role(Role.FARMER.value, Role.HYBRID.value)
worker_only = require_role(Role.WORKER.value, Role.HYBRID.value)


def _get_job(db: Session, job_id: int) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return job


def _require_owner(job: Job, user: User) -> None:
    if job.farm.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This job belongs to another farmer")


@router.post("/jobs", response_model=schemas.JobOut, status_code=status.HTTP_201_CREATED)
def create_job(body: schemas.JobRequest, user: User = Depends(farmer_only), db: Session = Depends(get_db)):
    farm = db.get(Farm, body.farm_id)
    if farm is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Farm not found")
    if farm.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only post jobs for your own farms")

    data = body.model_dump()
    notify_radius_km = data.pop("notify_radius_km", 50.0) or 50.0

    job = Job(**data)
    job.farm = farm
    db.add(job)
    db.flush()

    # Automatically notify workers within the specified radius of the farm
    notified_count = 0
    worker_profiles = db.scalars(
        select(WorkerProfile)
        .join(User, WorkerProfile.user_id == User.id)
        .where(
            WorkerProfile.user_id != user.id,
            WorkerProfile.latitude.is_not(None),
            WorkerProfile.longitude.is_not(None),
            User.is_active == True,
        )
    ).all()

    for wp in worker_profiles:
        dist = distance_km(farm.latitude, farm.longitude, wp.latitude, wp.longitude)
        if dist <= notify_radius_km:
            create_notification(
                db,
                user_id=wp.user_id,
                title=f"New Job Nearby: {job.work_type}",
                message=(
                    f"A new job '{job.work_type}' at {farm.name} is {dist:.1f} km away "
                    f"from your location. Wage: ₹{job.wage_per_day:.0f}/day."
                ),
                type="JOB_ALERT",
                link="/marketplace",
            )
            notified_count += 1

    record_audit(
        db,
        user_id=user.id,
        action="CREATE_JOB",
        resource=f"job:{job.id}",
        details=f"Created job {job.work_type} (notified {notified_count} workers within {notify_radius_km} km)",
    )
    db.commit()
    return schemas.job_out(job, notified_count=notified_count)


@router.get("/jobs", response_model=list[schemas.JobOut])
def open_jobs(_: User = Depends(current_user), db: Session = Depends(get_db)):
    jobs = db.scalars(select(Job).where(Job.status == JobStatus.OPEN.value).order_by(Job.created_at.desc()))
    return [schemas.job_out(j) for j in jobs]


# NOTE: static paths (/jobs/mine, /jobs/nearby) must be declared before /jobs/{job_id}.
@router.get("/jobs/mine", response_model=list[schemas.JobOut])
def my_jobs(user: User = Depends(farmer_only), db: Session = Depends(get_db)):
    jobs = db.scalars(select(Job).join(Farm).where(Farm.owner_id == user.id).order_by(Job.created_at.desc()))
    return [schemas.job_out(j) for j in jobs]


@router.get("/jobs/nearby", response_model=list[schemas.JobOut])
def nearby_jobs(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180),
                radius_km: float = Query(25, gt=0), skill: str | None = None,
                _: User = Depends(current_user), db: Session = Depends(get_db)):
    out = []
    for j in db.scalars(select(Job).where(Job.status == JobStatus.OPEN.value)):
        d = distance_km(lat, lon, j.farm.latitude, j.farm.longitude)
        if d > radius_km:
            continue
        if skill and (j.required_skill or "").lower() != skill.lower():
            continue
        out.append(schemas.job_out(j, d))
    return sorted(out, key=lambda x: x.distance_km)


@router.get("/jobs/{job_id}", response_model=schemas.JobOut)
def get_job(job_id: int, _: User = Depends(current_user), db: Session = Depends(get_db)):
    return schemas.job_out(_get_job(db, job_id))


@router.patch("/jobs/{job_id}/cancel", response_model=schemas.JobOut)
def cancel_job(job_id: int, user: User = Depends(farmer_only), db: Session = Depends(get_db)):
    job = _get_job(db, job_id)
    _require_owner(job, user)
    if job.status != JobStatus.OPEN.value:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot cancel a job with status {job.status}")
    job.status = JobStatus.CANCELLED.value
    # Reject remaining pending applications
    for other in db.scalars(select(JobApplication).where(
            JobApplication.job_id == job.id,
            JobApplication.status == ApplicationStatus.PENDING.value)):
        other.status = ApplicationStatus.REJECTED.value
        create_notification(
            db,
            user_id=other.worker_id,
            title="Job Cancelled",
            message=f"The job '{job.work_type}' at {job.farm.name} has been cancelled by the farmer.",
            type="JOB_CANCELLED",
        )
    record_audit(db, user_id=user.id, action="CANCEL_JOB", resource=f"job:{job.id}")
    db.commit()
    return schemas.job_out(job)


@router.post("/jobs/{job_id}/apply", response_model=schemas.ApplicationOut)
def apply(job_id: int, user: User = Depends(worker_only), db: Session = Depends(get_db)):
    job = _get_job(db, job_id)
    if job.status != JobStatus.OPEN.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "This job is no longer open")
    if job.farm.owner_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot apply to your own job")
    if db.scalar(select(JobApplication).where(JobApplication.job_id == job_id,
                                              JobApplication.worker_id == user.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "You already applied to this job")
    app = JobApplication(job_id=job_id, worker_id=user.id)
    db.add(app)
    db.flush()
    create_notification(
        db,
        user_id=job.farm.owner_id,
        title="New Application Received",
        message=f"{user.name} applied for '{job.work_type}' at {job.farm.name}.",
        type="APPLICATION",
        link=f"/jobs/{job.id}/applications",
    )
    db.commit()
    return schemas.application_out(app)


@router.get("/jobs/{job_id}/applications", response_model=list[schemas.ApplicationOut])
def job_applications(job_id: int, user: User = Depends(farmer_only), db: Session = Depends(get_db)):
    job = _get_job(db, job_id)
    _require_owner(job, user)
    apps = db.scalars(select(JobApplication).where(JobApplication.job_id == job_id)
                      .order_by(JobApplication.applied_at))
    return [schemas.application_out(a) for a in apps]


@router.get("/jobs/{job_id}/matches", response_model=list[schemas.MatchOut])
def job_matches(job_id: int, user: User = Depends(farmer_only), db: Session = Depends(get_db)):
    job = _get_job(db, job_id)
    _require_owner(job, user)
    return matching.rank_workers(db, job)


@router.post("/applications/{application_id}/accept", response_model=schemas.BookingOut)
def accept_application(application_id: int, user: User = Depends(farmer_only), db: Session = Depends(get_db)):
    app = db.get(JobApplication, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    job = app.job
    _require_owner(job, user)
    if app.status != ApplicationStatus.PENDING.value:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Application was already {app.status}")
    if job.status != JobStatus.OPEN.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "This job is no longer open")

    # Double-booking prevention (FR-APP-07): Check for overlapping confirmed bookings
    job_start = job.start_date
    job_end = job_start + timedelta(days=job.duration_days)
    confirmed_bookings = db.scalars(
        select(Booking).where(
            Booking.worker_id == app.worker_id,
            Booking.status == BookingStatus.CONFIRMED.value,
        )
    ).all()
    for b in confirmed_bookings:
        other_start = b.job.start_date
        other_end = other_start + timedelta(days=b.job.duration_days)
        if job_start < other_end and other_start < job_end:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Worker already has a confirmed booking for overlapping dates ({other_start} to {other_end})",
            )

    app.status = ApplicationStatus.ACCEPTED.value
    booking = Booking(job_id=job.id, worker_id=app.worker_id)
    db.add(booking)
    db.flush()

    create_notification(
        db,
        user_id=app.worker_id,
        title="Application Accepted!",
        message=f"You have been hired for '{job.work_type}' at {job.farm.name} starting {job.start_date}.",
        type="BOOKING",
        link="/bookings",
    )
    record_audit(
        db,
        user_id=user.id,
        action="ACCEPT_APPLICATION",
        resource=f"booking:{booking.id}",
        details=f"Accepted worker {app.worker_id} for job {job.id}",
    )

    taken = db.scalar(select(func.count(Booking.id)).where(Booking.job_id == job.id))
    if taken >= job.workers_required:
        job.status = JobStatus.FILLED.value
        for other in db.scalars(select(JobApplication).where(
                JobApplication.job_id == job.id,
                JobApplication.status == ApplicationStatus.PENDING.value)):
            other.status = ApplicationStatus.REJECTED.value
            create_notification(
                db,
                user_id=other.worker_id,
                title="Job Filled",
                message=f"The job '{job.work_type}' has been filled by other applicants.",
                type="APPLICATION_REJECTED",
            )
    db.commit()
    return schemas.booking_out(booking)
