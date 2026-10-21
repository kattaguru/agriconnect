from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .routers import (admin, auth, bookings, farms, intelligence, jobs,
                      notifications, reviews, simulations, workers)
from .seed import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)  # MVP only; switch to Alembic migrations before production
    with SessionLocal() as db:
        try:
            seed_demo_data(db)
        except Exception:
            pass
    yield


app = FastAPI(
    title="AgriConnect API",
    description="AI-Powered Agricultural Workforce & Farm Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, farms, jobs, bookings, reviews, workers, simulations, notifications, intelligence, admin):
    app.include_router(r.router)


@app.get("/health", tags=["meta"])
@app.get("/api", tags=["meta"])
@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "app": "AgriConnect", "version": "1.0.0"}


@app.get("/api/demo/users", tags=["meta"])
def demo_users(db: Session = Depends(get_db)):
    """Convenience endpoint for frontend quick-login demo switching."""
    return seed_demo_data(db)


@app.post("/api/demo/reset", tags=["meta"])
def demo_reset(db: Session = Depends(get_db)):
    """Convenience endpoint to reset demo database to clean baseline state."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return seed_demo_data(db)
