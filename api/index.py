import sys
from pathlib import Path

# Add project root directory to sys.path so app modules are discoverable
root_path = Path(__file__).resolve().parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

from app.main import app

# Explicit top-level entrypoint aliases recognized by Vercel's AST analyzer
app = app
application = app
handler = app
