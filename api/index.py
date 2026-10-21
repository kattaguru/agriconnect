import os
import sys
import traceback
from pathlib import Path

# Add possible root directories to sys.path so app modules are discoverable
current_dir = Path(__file__).resolve().parent
candidates = [
    current_dir.parent,  # /var/task (project root)
    current_dir,         # /var/task/api
    Path.cwd(),          # working directory
]

for p in candidates:
    if p.exists() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

try:
    from app.main import app
except Exception as e:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="AgriConnect Deployment Diagnostic")
    err_type = type(e).__name__
    err_str = str(e)
    err_tb = traceback.format_exc()

    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    def diagnostic_fallback(full_path: str):
        parent_dir = current_dir.parent
        dir_listing = [f.name for f in parent_dir.iterdir()] if parent_dir.exists() else []
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "type": err_type,
                "message": "FastAPI initialization failed on Vercel",
                "detail": err_str,
                "sys_path": sys.path,
                "cwd": os.getcwd(),
                "root_files": dir_listing,
                "traceback": err_tb.splitlines(),
            },
        )
