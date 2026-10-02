from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.applications import router as applications_router
from app.api.auth import router as auth_router
from app.api.governance import router as governance_router
from app.api.hunter import router as hunter_router
from app.api.reviewer import router as reviewer_router
from app.db.database import init_db
from app.db.seed import seed_demo_data


app = FastAPI(
    title="AegisAI Governance Engine",
    description=(
        "Multi-Tenant AI Decision Governance Engine "
        "for FinTech Lending"
    ),
    version="1.0.0",
)


@app.on_event("startup")
def startup_event() -> None:
    init_db()
    seed_demo_data()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(applications_router)
app.include_router(reviewer_router)
app.include_router(governance_router)
app.include_router(hunter_router)


@app.get("/")
def root():
    return {
        "message": "AegisAI Governance Engine is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }