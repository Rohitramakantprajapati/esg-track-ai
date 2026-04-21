from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Alert, EnvironmentalData, SocialData
from app.routers.scores import compute_monthly_scores
from app.services.alerts import month_end_reminder, upsert_alert
from app.services.scoring import BENCHMARKS

router = APIRouter(prefix="/alerts", tags=["alerts"])


def generate_auto_alerts(company_id: int, db: Session):
    monthly = compute_monthly_scores(company_id, db)
    if len(monthly) >= 2:
        curr = monthly[-1]["total_score"]
        prev = monthly[-2]["total_score"]
        drop = prev - curr
        if drop > 10:
            upsert_alert(
                db,
                company_id,
                "critical",
                f"ESG score dropped by {drop:.2f} points compared to previous month",
                f"score_drop_{monthly[-1]['year']}_{monthly[-1]['month']}",
            )

    latest_env = (
        db.query(EnvironmentalData)
        .filter(EnvironmentalData.company_id == company_id)
        .order_by(EnvironmentalData.year.desc(), EnvironmentalData.month.desc())
        .first()
    )
    latest_social = (
        db.query(SocialData)
        .filter(SocialData.company_id == company_id)
        .order_by(SocialData.year.desc(), SocialData.month.desc())
        .first()
    )
    if latest_env and latest_social:
        employees = max(1, latest_social.total_employees)
        checks = [
            (
                "carbon",
                latest_env.carbon_emissions_tonnes / employees,
                BENCHMARKS["carbon"],
                "Carbon intensity exceeds 150% of benchmark",
            ),
            (
                "energy",
                latest_env.energy_kwh / employees,
                BENCHMARKS["energy"],
                "Energy consumption exceeds 150% of benchmark",
            ),
            (
                "water",
                latest_env.water_litres / employees,
                BENCHMARKS["water"],
                "Water usage exceeds 150% of benchmark",
            ),
        ]
        for key, actual, benchmark, msg in checks:
            if actual > benchmark * 1.5:
                upsert_alert(
                    db,
                    company_id,
                    "warning",
                    msg,
                    f"benchmark_{key}_{latest_env.year}_{latest_env.month}",
                )

    now = datetime.utcnow()
    sev, msg, source = month_end_reminder(company_id, now.month, now.year)
    if sev:
        upsert_alert(db, company_id, sev, msg, source)


@router.get("/{company_id}")
def list_alerts(
    company_id: int,
    severity: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    generate_auto_alerts(company_id, db)
    q = db.query(Alert).filter(Alert.company_id == company_id)
    if severity:
        q = q.filter(Alert.severity == severity)
    return q.order_by(Alert.created_at.desc()).all()


@router.put("/read/{alert_id}")
def mark_alert_read(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).one_or_none()
    if not alert:
        return {"message": "Alert not found"}
    alert.is_read = True
    db.commit()
    return {"message": "Marked as read"}
