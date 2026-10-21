import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory OTP storage for phone login: standard_phone -> {"otp": str, "expires_at": datetime}
_phone_otp_store: dict[str, dict] = {}


def find_user_by_phone(db: Session, phone_raw: str) -> models.User | None:
    """Finds user by matching cleaned last 10 digits against database phone column."""
    clean_digits = "".join(filter(str.isdigit, phone_raw))
    if len(clean_digits) < 10:
        return None
    standard = clean_digits[-10:]
    clean_col = func.replace(func.replace(func.replace(models.User.phone, " ", ""), "-", ""), "+91", "")
    return db.scalar(
        select(models.User).where(
            (models.User.phone == standard) |
            (models.User.phone.like(f"%{standard}%")) |
            (models.User.phone.like(f"%{standard[:5]}%{standard[5:]}%")) |
            (clean_col.like(f"%{standard}%"))
        )
    )


@router.post("/register", response_model=schemas.AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    phone = (body.phone or "").strip() or None

    if db.scalar(select(models.User).where(models.User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    
    if phone:
        # Check if phone number already belongs to another user
        clean_phone = "".join(filter(str.isdigit, phone))
        existing_phone = db.scalar(select(models.User).where(models.User.phone == phone))
        if not existing_phone and len(clean_phone) >= 10:
            existing_phone = db.scalar(select(models.User).where(models.User.phone.like(f"%{clean_phone[-10:]}%")))
        if existing_phone:
            raise HTTPException(status.HTTP_409_CONFLICT, "Phone number already registered to another account")

    user = models.User(
        name=body.name.strip(),
        email=email,
        phone=phone,
        role=body.role,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()
    if user.role in (models.Role.WORKER.value, models.Role.HYBRID.value):
        db.add(models.WorkerProfile(user_id=user.id, skills=[]))
    db.commit()
    return schemas.AuthResponse(
        token=create_token(user),
        user_id=user.id,
        name=user.name,
        role=user.role,
        email=user.email,
        phone=user.phone,
    )


@router.post("/login", response_model=schemas.AuthResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    identifier = (body.identifier or body.email or body.phone or "").strip()
    if not identifier:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email address or phone number is required")

    clean_digits = "".join(filter(str.isdigit, identifier))
    user = None

    # 1. Try matching by email if it contains '@' or looks like an email
    if "@" in identifier:
        user = db.scalar(select(models.User).where(models.User.email == identifier.lower()))
    else:
        # 2. Try matching by phone number or exact email fallback
        if len(clean_digits) >= 10:
            user = db.scalar(
                select(models.User).where(
                    (models.User.phone == identifier) |
                    (models.User.phone.like(f"%{clean_digits[-10:]}%"))
                )
            )
        if user is None:
            user = db.scalar(select(models.User).where(models.User.email == identifier.lower()))

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email, phone number, or password")
    if not getattr(user, "is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")

    return schemas.AuthResponse(
        token=create_token(user),
        user_id=user.id,
        name=user.name,
        role=user.role,
        email=user.email,
        phone=user.phone,
    )


@router.post("/oauth-sync", response_model=schemas.AuthResponse)
def oauth_sync(body: schemas.OAuthSyncRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    phone = (body.phone or "").strip() or None

    # Check if user already exists by email or phone
    query = select(models.User).where(models.User.email == email)
    if phone:
        clean_phone = "".join(filter(str.isdigit, phone))
        if len(clean_phone) >= 10:
            query = select(models.User).where(
                (models.User.email == email) |
                (models.User.phone == phone) |
                (models.User.phone.like(f"%{clean_phone[-10:]}%"))
            )
    user = db.scalar(query)

    if not user:
        # Create new user via OAuth
        user = models.User(
            name=body.name.strip(),
            email=email,
            phone=phone,
            role=body.role,
            password_hash=hash_password(f"oauth-{body.provider}-{email}"),
        )
        db.add(user)
        db.flush()
        if user.role in (models.Role.WORKER.value, models.Role.HYBRID.value):
            db.add(models.WorkerProfile(user_id=user.id, skills=[]))
        db.commit()
    else:
        # Update phone if not set previously
        if phone and not user.phone:
            user.phone = phone
            db.commit()

    if not getattr(user, "is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")

    return schemas.AuthResponse(
        token=create_token(user),
        user_id=user.id,
        name=user.name,
        role=user.role,
        email=user.email,
        phone=user.phone,
    )


@router.post("/phone/send-otp", response_model=schemas.PhoneSendOtpResponse)
def phone_send_otp(body: schemas.PhoneSendOtpRequest, db: Session = Depends(get_db)):
    clean_digits = "".join(filter(str.isdigit, body.phone))
    if len(clean_digits) < 10:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Please enter a valid 10-digit mobile number."
        )

    standard_phone = clean_digits[-10:]

    # Check if this phone number is registered
    existing_user = find_user_by_phone(db, standard_phone)

    # Generate 6-digit OTP and store with 5-minute expiry
    otp = f"{random.randint(100000, 999999)}"
    _phone_otp_store[standard_phone] = {
        "otp": otp,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
    }

    return schemas.PhoneSendOtpResponse(
        status="success",
        message=f"OTP sent successfully to +91 {standard_phone[:5]} {standard_phone[5:]}.",
        phone=standard_phone,
        is_existing_user=existing_user is not None,
        demo_otp=otp,
    )


@router.post("/phone/verify-otp", response_model=schemas.AuthResponse)
def phone_verify_otp(body: schemas.PhoneVerifyOtpRequest, db: Session = Depends(get_db)):
    clean_digits = "".join(filter(str.isdigit, body.phone))
    if len(clean_digits) < 10:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Please enter a valid 10-digit mobile number."
        )

    standard_phone = clean_digits[-10:]
    entered_otp = body.otp.strip()

    # Validate OTP (Accept matching generated OTP or master demo OTP "123456")
    is_valid = False
    if entered_otp == "123456":
        is_valid = True
    elif standard_phone in _phone_otp_store:
        record = _phone_otp_store[standard_phone]
        if record["expires_at"] > datetime.now(timezone.utc) and record["otp"] == entered_otp:
            is_valid = True

    if not is_valid:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Invalid or expired OTP. Please enter the correct 6-digit code or use '123456' for testing."
        )

    # Clean used OTP
    _phone_otp_store.pop(standard_phone, None)

    # Find existing user
    user = find_user_by_phone(db, standard_phone)

    if user:
        if not getattr(user, "is_active", True):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")
        return schemas.AuthResponse(
            token=create_token(user),
            user_id=user.id,
            name=user.name,
            role=user.role,
            email=user.email,
            phone=user.phone,
        )

    # Auto-register new mobile user
    name = (body.name or "").strip() or f"User {standard_phone[-4:]}"
    role = body.role if body.role in ("FARMER", "WORKER", "HYBRID") else "FARMER"
    email = f"phone_{standard_phone}@agriconnect.local"

    # Ensure unique email if somehow taken
    if db.scalar(select(models.User).where(models.User.email == email)):
        email = f"phone_{standard_phone}_{int(datetime.now().timestamp())}@agriconnect.local"

    formatted_phone = f"+91 {standard_phone[:5]} {standard_phone[5:]}"
    user = models.User(
        name=name,
        email=email,
        phone=formatted_phone,
        role=role,
        password_hash=hash_password(f"phone-otp-{standard_phone}"),
    )
    db.add(user)
    db.flush()

    if user.role in (models.Role.WORKER.value, models.Role.HYBRID.value):
        db.add(models.WorkerProfile(user_id=user.id, skills=[]))
    db.commit()

    return schemas.AuthResponse(
        token=create_token(user),
        user_id=user.id,
        name=user.name,
        role=user.role,
        email=user.email,
        phone=user.phone,
    )


@router.put("/me/role", response_model=schemas.AuthResponse)
def update_my_role(
    body: schemas.UpdateRoleRequest,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Allows user to switch dynamically between FARMER (only farmer), WORKER (only worker), or HYBRID (both)."""
    user.role = body.role
    if user.role in (models.Role.WORKER.value, models.Role.HYBRID.value):
        profile = db.scalar(select(models.WorkerProfile).where(models.WorkerProfile.user_id == user.id))
        if not profile:
            db.add(models.WorkerProfile(user_id=user.id, skills=[]))
    db.commit()
    db.refresh(user)

    return schemas.AuthResponse(
        token=create_token(user),
        user_id=user.id,
        name=user.name,
        role=user.role,
        email=user.email,
        phone=user.phone,
    )
