from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .security import hash_password, create_token


def seed_demo_data(db: Session) -> dict:
    """Seeds baseline demo data for Ravi (Farmer), Suresh (Worker), Lakshmi (Worker), and Admin."""
    admin_email = "admin@agriconnect.com"
    farmer_email = "ravi@example.com"
    worker_email = "suresh@example.com"
    worker2_email = "lakshmi@example.com"

    # 1. Admin
    admin = db.scalar(select(models.User).where(models.User.email == admin_email))
    if not admin:
        admin = models.User(
            name="Platform Administrator",
            email=admin_email,
            phone="+91 98765 00000",
            password_hash=hash_password("admin12345"),
            role=models.Role.ADMIN.value,
        )
        db.add(admin)

    # 2. Farmer (Ravi)
    farmer = db.scalar(select(models.User).where(models.User.email == farmer_email))
    if not farmer:
        farmer = models.User(
            name="Ravi Kumar (Farmer)",
            email=farmer_email,
            phone="+91 94401 23456",
            password_hash=hash_password("password123"),
            role=models.Role.FARMER.value,
        )
        db.add(farmer)
        db.flush()

        # Add Farm for Ravi
        farm = models.Farm(
            owner_id=farmer.id,
            name="Sri Venkateswara Groundnut Farm",
            area_acres=3.5,
            latitude=13.63,
            longitude=79.40,
            soil_info="Red sandy loam, optimal pH 6.5, good organic content",
        )
        db.add(farm)
        db.flush()

        # Add Job for Ravi
        tomorrow = date.today() + timedelta(days=1)
        job = models.Job(
            farm_id=farm.id,
            work_type="Groundnut Harvesting & Pod Stripping",
            required_skill="harvesting",
            workers_required=2,
            start_date=tomorrow,
            duration_days=3,
            wage_per_day=550.0,
            status=models.JobStatus.OPEN.value,
        )
        db.add(job)

    # 3. Worker 1 (Suresh)
    worker = db.scalar(select(models.User).where(models.User.email == worker_email))
    if not worker:
        worker = models.User(
            name="Suresh Naidu (Worker)",
            email=worker_email,
            phone="+91 98852 34567",
            password_hash=hash_password("password123"),
            role=models.Role.WORKER.value,
        )
        db.add(worker)
        db.flush()
        db.add(models.WorkerProfile(
            user_id=worker.id,
            skills=["harvesting", "ploughing", "weeding", "pod stripping"],
            experience_years=5,
            latitude=13.65,
            longitude=79.42,
            available=True,
        ))

    # 4. Worker 2 (Lakshmi)
    worker2 = db.scalar(select(models.User).where(models.User.email == worker2_email))
    if not worker2:
        worker2 = models.User(
            name="Lakshmi Devi (Worker)",
            email=worker2_email,
            phone="+91 97012 45678",
            password_hash=hash_password("password123"),
            role=models.Role.WORKER.value,
        )
        db.add(worker2)
        db.flush()
        db.add(models.WorkerProfile(
            user_id=worker2.id,
            skills=["weeding", "transplanting", "harvesting"],
            experience_years=4,
            latitude=13.61,
            longitude=79.38,
            available=True,
        ))

    # 5. Hybrid (Anand Reddy - Farmer + Worker)
    hybrid_email = "anand@example.com"
    hybrid = db.scalar(select(models.User).where(models.User.email == hybrid_email))
    if not hybrid:
        hybrid = models.User(
            name="Anand Reddy (Hybrid)",
            email=hybrid_email,
            phone="+91 99887 65432",
            password_hash=hash_password("password123"),
            role=models.Role.HYBRID.value,
        )
        db.add(hybrid)
        db.flush()

        # Hybrid user's farm
        db.add(models.Farm(
            owner_id=hybrid.id,
            name="Sri Krishna Paddy & Vegetable Farm",
            area_acres=2.0,
            latitude=13.62,
            longitude=79.39,
            soil_info="Clay loam, optimal for paddy and seasonal vegetables",
        ))

        # Hybrid user's worker profile
        db.add(models.WorkerProfile(
            user_id=hybrid.id,
            skills=["transplanting", "harvesting", "tractor operation"],
            experience_years=6,
            latitude=13.62,
            longitude=79.39,
            available=True,
        ))

    # Initial notifications
    if farmer and not db.scalar(select(models.Notification).where(models.Notification.user_id == farmer.id)):
        db.add(models.Notification(
            user_id=farmer.id,
            title="Welcome to AgriConnect!",
            message="Your farm 'Sri Venkateswara Groundnut Farm' is registered. Post jobs or run profit simulations anytime.",
            type="SYSTEM",
        ))

    if worker and not db.scalar(select(models.Notification).where(models.Notification.user_id == worker.id)):
        db.add(models.Notification(
            user_id=worker.id,
            title="Profile Ready",
            message="Your worker profile is active. Check nearby harvesting jobs in Tirupati region.",
            type="SYSTEM",
        ))

    if hybrid and not db.scalar(select(models.Notification).where(models.Notification.user_id == hybrid.id)):
        db.add(models.Notification(
            user_id=hybrid.id,
            title="Hybrid Workspace Active",
            message="You have dual privileges: hire workers for Sri Krishna Farm and apply for jobs nearby.",
            type="SYSTEM",
        ))

    if g_user and not db.scalar(select(models.Notification).where(models.Notification.user_id == g_user.id)):
        db.add(models.Notification(
            user_id=g_user.id,
            title="Welcome Guravaiah Katta!",
            message="Your farm 'Sri Venkateswara Agro Farm' is registered and ready for job postings.",
            type="SYSTEM",
        ))

    db.commit()

    return {
        "admin": {"user_id": admin.id, "name": admin.name, "email": admin_email, "role": "ADMIN", "token": create_token(admin)},
        "farmer": {"user_id": farmer.id, "name": farmer.name, "email": farmer_email, "role": "FARMER", "token": create_token(farmer)},
        "worker": {"user_id": worker.id, "name": worker.name, "email": worker_email, "role": "WORKER", "token": create_token(worker)},
        "hybrid": {"user_id": hybrid.id, "name": hybrid.name, "email": hybrid_email, "role": "HYBRID", "token": create_token(hybrid)},
        "user": {"user_id": g_user.id, "name": g_user.name, "email": g_user.email, "role": g_user.role, "token": create_token(g_user)},
    }
