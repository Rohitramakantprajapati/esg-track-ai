from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Alert


def upsert_alert(db: Session, company_id: int, severity: str, message: str, source_key: str) -> None:
    existing = (
        db.query(Alert)
        .filter(Alert.company_id == company_id, Alert.source_key == source_key)
        .one_or_none()
    )
    if existing:
        existing.severity = severity
        existing.message = message
    else:
        db.add(
            Alert(
                company_id=company_id,
                severity=severity,
                message=message,
                source_key=source_key,
            )
        )
    db.commit()


def month_end_reminder(company_id: int, month: int, year: int) -> tuple[str, str, str]:
    today = datetime.utcnow()
    if today.day >= 25:
        return (
            "warning",
            f"Month-end ESG submission reminder for {month:02d}/{year}",
            f"month_end_{company_id}_{month}_{year}",
        )
    return ("", "", "")
