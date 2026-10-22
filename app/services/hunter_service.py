from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Application, AuditLog, HunterAlert
from app.services.datetime_service import serialize_utc_datetime


class HunterService:
    """Persistent duplicate-application detection without cross-tenant disclosure."""

    def check_application(
        self,
        db: Session,
        application: Application,
        actor_user_id: str | None = None,
        *,
        commit: bool = True,
    ) -> dict[str, Any]:
        applicant_filters = [Application.applicant_email == application.applicant_email]
        if not application.applicant_email:
            applicant_filters = [Application.applicant_name == application.applicant_name]

        duplicate = db.execute(
            select(Application)
            .where(
                Application.tenant_id != application.tenant_id,
                Application.loan_type == application.loan_type,
                Application.status.in_(("new", "in_review")),
                *applicant_filters,
            )
            .order_by(Application.created_at.asc())
        ).scalars().first()

        duplicate_detected = duplicate is not None
        if duplicate_detected:
            recipients = {
                application.tenant_id: "Potential duplicate loan application detected.",
                duplicate.tenant_id: "A potential duplicate loan application has been detected for this applicant.",
            }
            existing_recipients = set(
                db.execute(
                    select(HunterAlert.recipient_tenant_id).where(
                        HunterAlert.application_id == application.id,
                        HunterAlert.alert_type == "DUPLICATE_LOAN_APPLICATION",
                        HunterAlert.recipient_tenant_id.in_(recipients),
                    )
                ).scalars()
            )
            for recipient_tenant_id, message in recipients.items():
                if recipient_tenant_id not in existing_recipients:
                    self._create_alert(
                        db,
                        recipient_tenant_id=recipient_tenant_id,
                        application=application,
                        message=message,
                    )

        db.add(
            AuditLog(
                tenant_id=application.tenant_id,
                actor_user_id=actor_user_id,
                action="HUNTER_DUPLICATE_DETECTED" if duplicate_detected else "HUNTER_CHECK_COMPLETED",
                resource_type="application",
                resource_id=application.id,
                metadata_data={
                    "application_id": application.id,
                    "loan_type": application.loan_type,
                    "duplicate_detected": duplicate_detected,
                    "cross_tenant_match": duplicate_detected,
                },
            )
        )
        if commit:
            db.commit()
        else:
            db.flush()

        if duplicate_detected:
            return {
                "alert_id": self._latest_alert_id(db, application.id, application.tenant_id),
                "recipient_tenant_id": application.tenant_id,
                "severity": "HIGH",
                "status": "OPEN",
                "action": "BANK_REVIEW",
                "message": "Potential duplicate loan application detected.",
            }
        return {"duplicate_detected": False, "action": "CONTINUE"}

    def get_alerts(self, db: Session, tenant_id: str) -> list[dict[str, Any]]:
        alerts = db.execute(
            select(HunterAlert)
            .where(HunterAlert.recipient_tenant_id == tenant_id)
            .order_by(HunterAlert.created_at.desc())
        ).scalars().all()
        return [self._serialize_alert(alert) for alert in alerts]

    @staticmethod
    def _create_alert(db: Session, recipient_tenant_id: str, application: Application, message: str) -> None:
        db.add(
            HunterAlert(
                recipient_tenant_id=recipient_tenant_id,
                application_id=application.id,
                alert_type="DUPLICATE_LOAN_APPLICATION",
                severity="HIGH",
                status="OPEN",
                loan_type=application.loan_type or "unknown",
                message=message,
            )
        )

    @staticmethod
    def _latest_alert_id(db: Session, application_id: str, tenant_id: str) -> str | None:
        alert = db.execute(
            select(HunterAlert.alert_id)
            .where(HunterAlert.application_id == application_id, HunterAlert.recipient_tenant_id == tenant_id)
            .order_by(HunterAlert.created_at.desc())
        ).scalars().first()
        return alert

    @staticmethod
    def _serialize_alert(alert: HunterAlert) -> dict[str, Any]:
        return {
            "alert_id": alert.alert_id,
            "recipient_tenant_id": alert.recipient_tenant_id,
            "application_id": alert.application_id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "status": alert.status,
            "loan_type": alert.loan_type,
            "message": alert.message,
            "created_at": serialize_utc_datetime(alert.created_at),
        }


hunter_service = HunterService()