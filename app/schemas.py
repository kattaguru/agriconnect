from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from . import models


# ---- auth ----
class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)
    role: Literal["FARMER", "WORKER", "HYBRID"]
    phone: str | None = None


class LoginRequest(BaseModel):
    identifier: str | None = None
    email: str | None = None
    phone: str | None = None
    password: str = Field(min_length=1)


class AuthResponse(BaseModel):
    token: str
    user_id: int
    name: str
    role: str
    email: str | None = None
    phone: str | None = None


class OAuthSyncRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    name: str = Field(min_length=1, max_length=120)
    role: Literal["FARMER", "WORKER", "HYBRID"] = "FARMER"
    phone: str | None = None
    provider: str = "google"


class PhoneSendOtpRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=25)


class PhoneSendOtpResponse(BaseModel):
    status: str
    message: str
    phone: str
    is_existing_user: bool
    demo_otp: str | None = None


class PhoneVerifyOtpRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=25)
    otp: str = Field(min_length=4, max_length=10)
    name: str | None = None
    role: Literal["FARMER", "WORKER", "HYBRID"] = "FARMER"


class UpdateRoleRequest(BaseModel):
    role: Literal["FARMER", "WORKER", "HYBRID"]


# ---- farms ----
class FarmRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    area_acres: float = Field(gt=0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    soil_info: str | None = None


class FarmOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    name: str
    area_acres: float
    latitude: float
    longitude: float
    soil_info: str | None


# ---- jobs ----
class JobRequest(BaseModel):
    farm_id: int
    work_type: str = Field(min_length=1, max_length=120)
    required_skill: str | None = None
    workers_required: int = Field(ge=1)
    start_date: date
    duration_days: int = Field(ge=1)
    wage_per_day: float = Field(gt=0)
    notify_radius_km: float | None = Field(default=50.0, ge=1.0, le=100.0)

    @field_validator("start_date")
    @classmethod
    def not_in_past(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("start_date cannot be in the past")
        return v


class JobOut(BaseModel):
    id: int
    farm_id: int
    farm_name: str
    work_type: str
    required_skill: str | None
    workers_required: int
    start_date: date
    duration_days: int
    wage_per_day: float
    status: str
    distance_km: float | None = None
    notified_workers_count: int | None = None


def job_out(j: models.Job, distance: float | None = None, notified_count: int | None = None) -> JobOut:
    return JobOut(
        id=j.id, farm_id=j.farm_id, farm_name=j.farm.name, work_type=j.work_type,
        required_skill=j.required_skill, workers_required=j.workers_required,
        start_date=j.start_date, duration_days=j.duration_days, wage_per_day=j.wage_per_day,
        status=j.status, distance_km=None if distance is None else round(distance, 1),
        notified_workers_count=notified_count,
    )


class ApplicationOut(BaseModel):
    id: int
    job_id: int
    worker_id: int
    worker_name: str
    status: str
    applied_at: datetime


def application_out(a: models.JobApplication) -> ApplicationOut:
    return ApplicationOut(id=a.id, job_id=a.job_id, worker_id=a.worker_id,
                          worker_name=a.worker.name, status=a.status, applied_at=a.applied_at)


class BookingOut(BaseModel):
    id: int
    job_id: int
    work_type: str
    worker_id: int
    worker_name: str
    status: str
    created_at: datetime
    completed_at: datetime | None


def booking_out(b: models.Booking) -> BookingOut:
    return BookingOut(id=b.id, job_id=b.job_id, work_type=b.job.work_type, worker_id=b.worker_id,
                      worker_name=b.worker.name, status=b.status, created_at=b.created_at,
                      completed_at=b.completed_at)


# ---- reviews ----
class ReviewRequest(BaseModel):
    booking_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    booking_id: int
    reviewer_id: int
    reviewed_id: int
    rating: int
    comment: str | None


# ---- workers ----
class WorkerProfileRequest(BaseModel):
    skills: list[str] = []
    experience_years: int = Field(default=0, ge=0)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    available: bool = True


class WorkerOut(BaseModel):
    id: int
    name: str
    skills: list[str]
    experience_years: int
    latitude: float | None
    longitude: float | None
    available: bool
    avg_rating: float | None
    review_count: int


class MatchOut(BaseModel):
    worker_id: int
    name: str
    score: float
    distance_km: float | None
    reasons: list[str]


# ---- profit simulator ----
class SellingOptionInput(BaseModel):
    name: str
    market_price: float = Field(ge=0)
    transport_per_qtl: float = Field(default=0.0, ge=0)
    commission_per_qtl: float = Field(default=0.0, ge=0)
    storage_cost_per_day_per_qtl: float = Field(default=0.0, ge=0)
    days_stored: int = Field(default=0, ge=0)
    shrinkage_percent: float = Field(default=0.0, ge=0, le=100)


class SimulationInput(BaseModel):
    crop_name: str = Field(min_length=1, max_length=100)
    area_acres: float = Field(gt=0)
    expected_yield_qtl: float = Field(ge=0)
    selling_price_per_qtl: float = Field(ge=0)
    seed_cost: float = Field(default=0.0, ge=0)
    fertilizer_cost: float = Field(default=0.0, ge=0)
    pesticide_cost: float = Field(default=0.0, ge=0)
    irrigation_cost: float = Field(default=0.0, ge=0)
    labour_cost: float = Field(default=0.0, ge=0)
    workers_count: int | None = Field(default=None, ge=1)
    work_days: int | None = Field(default=None, ge=1)
    wage_per_day: float | None = Field(default=None, gt=0)
    machinery_cost: float = Field(default=0.0, ge=0)
    transport_cost: float = Field(default=0.0, ge=0)
    other_cost: float = Field(default=0.0, ge=0)
    selling_options: list[SellingOptionInput] | None = None


class ScenarioRow(BaseModel):
    scenario: str
    yield_qtl: float
    selling_price: float
    gross_revenue: float
    total_cost: float
    net_profit: float
    profit_per_acre: float
    roi_percent: float


class SellingOptionOut(BaseModel):
    name: str
    market_price: float
    net_price_per_qtl: float
    total_gross: float
    net_profit: float
    extra_transport_and_storage: float
    is_best: bool = False
    notes: str


class SimulationOutput(BaseModel):
    crop_name: str
    area_acres: float
    gross_revenue: float
    total_cost: float
    net_profit: float
    profit_per_acre: float
    break_even_price: float
    break_even_yield: float
    cost_breakdown: dict[str, float]
    scenarios: list[ScenarioRow]
    selling_options: list[SellingOptionOut]
    sensitivity: dict[str, float]
    disclaimer: str


class SaveSimulationRequest(BaseModel):
    farm_id: int | None = None
    crop_name: str
    area_acres: float
    inputs: dict
    results: dict


class ProfitSimulationOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    user_id: int
    farm_id: int | None
    crop_name: str
    area_acres: float
    inputs: dict
    results: dict
    created_at: datetime


# ---- notifications ----
class NotificationOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    link: str | None
    created_at: datetime


# ---- farm intelligence ----
class CandidateCrop(BaseModel):
    crop_name: str
    local_name: str
    compatibility_score: int
    duration_days: int
    expected_yield_range: str
    water_need: str
    profit_potential: str
    suitability_reasons: list[str]
    warnings: list[str]


class CropRecommendationRequest(BaseModel):
    district: str = "Tirupati"
    area_acres: float = Field(default=2.0, gt=0)
    soil_type: str | None = "Red Loamy"
    nitrogen_level: float | None = 220.0
    phosphorus_level: float | None = 25.0
    potassium_level: float | None = 280.0
    soil_ph: float | None = Field(default=6.8, ge=3.0, le=10.0)
    water_source: str = "Borewell"
    season: str = "Kharif"
    budget_inr: float | None = 40000.0


class CropRecommendationOut(BaseModel):
    recommended_crops: list[CandidateCrop]
    soil_health_assessment: str
    disclaimer: str


class DiseaseScanRequest(BaseModel):
    crop_name: str = "Groundnut"
    image_base64: str | None = None
    sample_id: str | None = None


class DiseaseScanResponse(BaseModel):
    crop_name: str
    disease_name: str
    confidence: float
    severity: str
    is_uncertain: bool
    symptoms: str
    organic_remedies: list[str]
    chemical_treatments: list[str]
    guidance_notes: str
    source_citation: str
    disclaimer: str


class DiseaseScanHistoryOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    crop_name: str
    disease_name: str
    confidence: float
    severity: str
    symptoms: str | None
    recommendations: str | None
    created_at: datetime


class RagQueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    crop: str | None = None


class RagSourceDoc(BaseModel):
    title: str
    source: str
    relevance_score: float
    excerpt: str


class RagQueryResponse(BaseModel):
    question: str
    answer: str
    grounded: bool
    sources: list[RagSourceDoc]
    confidence: float
    disclaimer: str


class MarketPriceOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    crop: str
    market: str
    district: str
    state: str
    arrival_date: date
    min_price: float
    max_price: float
    modal_price: float
    source: str
    trend: str = "STABLE"


class MarketComparisonRequest(BaseModel):
    crop: str = "Groundnut"
    quantity_qtl: float = Field(default=50.0, gt=0)
    current_lat: float = 13.63
    current_lon: float = 79.40
    transport_cost_per_km_qtl: float = Field(default=1.2, ge=0)


class MarketOptionOut(BaseModel):
    market_name: str
    district: str
    distance_km: float
    modal_price_per_qtl: float
    gross_value: float
    transport_cost_total: float
    net_return: float
    is_best: bool
    advantage_vs_nearest: float


class MarketComparisonOut(BaseModel):
    crop: str
    quantity_qtl: float
    options: list[MarketOptionOut]
    recommended_market: str


# ---- admin ----
class AdminMetricsOut(BaseModel):
    total_users: int
    total_farmers: int
    total_workers: int
    total_jobs: int
    open_jobs: int
    filled_jobs: int
    completed_jobs: int
    total_bookings: int
    completed_bookings: int
    total_reviews: int
    avg_platform_rating: float | None
    total_scans: int
    total_simulations: int


class UserAdminOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    name: str
    email: str
    phone: str | None
    role: str
    is_active: bool
    created_at: datetime


class AuditLogOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    user_id: int | None
    action: str
    resource: str
    details: str | None
    created_at: datetime
