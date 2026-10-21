from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import sys
from pathlib import Path

# Support running as a standalone entrypoint (Vercel) or as a package
if not __package__:
    _parent = Path(__file__).resolve().parent.parent
    if str(_parent) not in sys.path:
        sys.path.insert(0, str(_parent))
    from app import models  # noqa: F401
    from app.config import settings
    from app.database import Base, SessionLocal, engine, get_db
    from app.routers import (admin, auth, bookings, farms, intelligence, jobs,
                              notifications, reviews, simulations, workers)
    from app.seed import seed_demo_data
else:
    from . import models  # noqa: F401  (registers tables on Base.metadata)
    from .config import settings
    from .database import Base, SessionLocal, engine, get_db
    from .routers import (admin, auth, bookings, farms, intelligence, jobs,
                          notifications, reviews, simulations, workers)
    from .seed import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        Base.metadata.create_all(engine)  # MVP only; switch to Alembic migrations before production
        with SessionLocal() as db:
            try:
                seed_demo_data(db)
            except Exception as e:
                print("Seed demo data notice:", e)
    except Exception as e:
        print("Database startup notice (non-fatal):", e)
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
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
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


# Serve frontend SPA if built assets are present
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    _assets_dir = _frontend_dist / "assets"
    if _assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    @app.get("/", include_in_schema=False)
    def root_spa():
        index_file = _frontend_dist / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"status": "ok", "app": "AgriConnect", "version": "1.0.0"}

    @app.get("/{full_path:path}", include_in_schema=False)
    def catch_all_spa(full_path: str):
        if full_path.startswith(("api", "health", "docs", "redoc", "openapi.json")):
            raise HTTPException(404, "Not Found")
        file_candidate = _frontend_dist / full_path
        if file_candidate.is_file():
            return FileResponse(file_candidate)
        index_file = _frontend_dist / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"status": "ok", "app": "AgriConnect", "version": "1.0.0"}
else:
    @app.get("/", include_in_schema=False)
    def root_api():
        return {"status": "ok", "app": "AgriConnect", "version": "1.0.0"}

