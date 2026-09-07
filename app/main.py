from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.governance import router as governance_router


app = FastAPI(
    title="AegisAI Governance Engine",
    description=(
        "Multi-Tenant AI Decision Governance Engine "
        "for FinTech Lending"
    ),
    version="1.0.0",
)


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


app.include_router(governance_router)


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