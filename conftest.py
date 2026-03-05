import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
WORKER_DIR = ROOT / "worker"

for path in (BACKEND_DIR, WORKER_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)
