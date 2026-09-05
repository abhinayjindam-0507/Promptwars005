from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import init_db


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


@app.get("/")
async def root() -> dict[str, str]:
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
