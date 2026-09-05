from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.patients import router as patients_router
from app.api.reports import router as reports_router
from app.core.database import init_db

# Optional static frontend serving for single-container production deployment
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if not FRONTEND_DIST.exists():
    alt_dist = Path(__file__).resolve().parent.parent / "dist"
    if alt_dist.exists():
        FRONTEND_DIST = alt_dist


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically initialize database tables for local development
    init_db()
    yield


app = FastAPI(
    title="MedLens API",
    version="0.1.0",
    description="MedLens — AI-Powered Clinical Information Intelligence API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register domain API routers
app.include_router(patients_router, prefix="/api/patients", tags=["Patients"])
app.include_router(reports_router, prefix="/api", tags=["Reports"])

if FRONTEND_DIST.exists() and (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


@app.get("/")
async def root(request: Request):
    accept = request.headers.get("accept", "")
    if "text/html" in accept and FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
        return FileResponse(FRONTEND_DIST / "index.html")
    return {
        "name": "MedLens API",
        "status": "running",
        "version": "0.1.0",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "medlens-api",
    }


if FRONTEND_DIST.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = FRONTEND_DIST / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
