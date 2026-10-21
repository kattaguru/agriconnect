import sys
import traceback
from pathlib import Path

# Add project root directory to sys.path so app modules are discoverable
root_path = Path(__file__).resolve().parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

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
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "type": err_type,
                "message": "FastAPI initialization failed on Vercel",
                "detail": err_str,
                "traceback": err_tb.splitlines(),
            },
        )
