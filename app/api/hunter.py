from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Application, User
from app.services.auth_service import get_current_user
from app.services.hunter_service import hunter_service

router = APIRouter(prefix="/api/v1/hunter", tags=["Hunter"])


@router.post("/applications/{application_id}/check")
def check_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    application = db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.tenant_id == current_user.tenant_id,
        )
    ).scalar_one_or_none()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    return hunter_service.check_application(db, application, actor_user_id=current_user.id)


@router.get("/alerts")
def list_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return hunter_service.get_alerts(db, current_user.tenant_id)