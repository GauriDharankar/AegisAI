from fastapi import FastAPI

from app.api.governance import router as governance_router


app = FastAPI(
    title="AegisAI Governance Engine",
    description=(
        "Multi-Tenant AI Decision Governance Engine "
        "for FinTech Lending"
    ),
    version="1.0.0"
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