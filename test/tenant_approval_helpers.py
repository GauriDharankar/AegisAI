from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.database import SessionLocal
from app.db.models import PlatformAdmin, User, utcnow
from app.services.auth_service import create_platform_admin_user, create_session_token


def approve_tenant(client: TestClient, tenant_id: str) -> None:
    with SessionLocal() as db:
        platform_admin = db.execute(
            select(User)
            .join(PlatformAdmin, PlatformAdmin.user_id == User.id)
            .order_by(User.created_at)
        ).scalars().first()
        if platform_admin is None:
            platform_admin = create_platform_admin_user(
                db,
                full_name="Test Platform Admin",
                email=f"test_platform_{uuid.uuid4().hex[:10]}@example.com",
                password="SecurePass123",
                phone_number="+15555550100",
                phone_verified_at=utcnow(),
            )
            db.commit()
        token = create_session_token(platform_admin, role_name="Super Admin")

    headers = {"Authorization": f"Bearer {token}"}
    reviewed = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/review",
        headers=headers,
    )
    assert reviewed.status_code == 200, reviewed.text

    approved = client.post(
        f"/api/v1/platform-admin/tenants/{tenant_id}/verification/approve",
        headers=headers,
    )
    assert approved.status_code == 200, approved.text
