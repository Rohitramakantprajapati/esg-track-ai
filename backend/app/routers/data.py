from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EnvironmentalData, GovernanceData, SocialData, Submission
from app.schemas import EnvironmentalCreate, GovernanceCreate, SocialCreate
from auth import decode_token

router = APIRouter(prefix="/data", tags=["data"])


def serialize_environmental(item: EnvironmentalData | None):
    if not item:
        return None
    return {
        "carbon_emissions_tonnes": item.carbon_emissions_tonnes,
        "energy_kwh": item.energy_kwh,
        "water_litres": item.water_litres,
        "waste_kg": item.waste_kg,
        "recycled_waste_kg": item.recycled_waste_kg,
    }


def serialize_social(item: SocialData | None):
    if not item:
        return None
    return {
        "total_employees": item.total_employees,
        "female_employees": item.female_employees,
        "safety_incidents": item.safety_incidents,
        "training_hours": item.training_hours,
        "community_investment": item.community_investment,
    }


def serialize_governance(item: GovernanceData | None):
    if not item:
        return None
    return {
        "board_members": item.board_members,
        "independent_directors": item.independent_directors,
        "audit_meetings": item.audit_meetings,
        "has_whistleblower_policy": item.has_whistleblower_policy,
        "data_breaches": item.data_breaches,
    }


def fetch_period_records(db: Session, company_id: int, month: int, year: int):
    env = (
        db.query(EnvironmentalData)
        .filter(
            EnvironmentalData.company_id == company_id,
            EnvironmentalData.month == month,
            EnvironmentalData.year == year,
        )
        .one_or_none()
    )
    social = (
        db.query(SocialData)
        .filter(
            SocialData.company_id == company_id,
            SocialData.month == month,
            SocialData.year == year,
        )
        .one_or_none()
    )
    governance = (
        db.query(GovernanceData)
        .filter(
            GovernanceData.company_id == company_id,
            GovernanceData.month == month,
            GovernanceData.year == year,
        )
        .one_or_none()
    )
    return env, social, governance


@router.get("/monthly/{company_id}")
def get_monthly_data(
    company_id: int,
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    target_month = month
    target_year = year

    if target_month is None or target_year is None:
        candidates = []
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
        latest_governance = (
            db.query(GovernanceData)
            .filter(GovernanceData.company_id == company_id)
            .order_by(GovernanceData.year.desc(), GovernanceData.month.desc())
            .first()
        )
        for item in [latest_env, latest_social, latest_governance]:
            if item:
                candidates.append((item.year, item.month))

        if not candidates:
            return {
                "company_id": company_id,
                "month": None,
                "year": None,
                "has_data": False,
                "environmental": None,
                "social": None,
                "governance": None,
            }

        target_year, target_month = sorted(candidates)[-1]

    env, social, governance = fetch_period_records(db, company_id, target_month, target_year)

    return {
        "company_id": company_id,
        "month": target_month,
        "year": target_year,
        "has_data": any([env, social, governance]),
        "environmental": serialize_environmental(env),
        "social": serialize_social(social),
        "governance": serialize_governance(governance),
    }


def upsert_submission(db: Session, company_id: int, month: int, year: int, data_type: str):
    submission = (
        db.query(Submission)
        .filter(
            Submission.company_id == company_id,
            Submission.month == month,
            Submission.year == year,
            Submission.data_type == data_type,
        )
        .one_or_none()
    )
    if submission:
        submission.status = "pending"
        submission.submission_date = datetime.utcnow()
    else:
        db.add(
            Submission(
                company_id=company_id,
                month=month,
                year=year,
                data_type=data_type,
                status="pending",
            )
        )


def replace_period_data(db: Session, model, company_id: int, month: int, year: int):
    db.query(model).filter(
        model.company_id == company_id,
        model.month == month,
        model.year == year,
    ).delete(synchronize_session=False)


@router.post("/environmental")
def save_environmental(
    payload: EnvironmentalCreate,
    db: Session = Depends(get_db),
    user: str = Depends(decode_token),
):
    replace_period_data(db, EnvironmentalData, payload.company_id, payload.month, payload.year)
    item = EnvironmentalData(**payload.model_dump())
    db.add(item)

    upsert_submission(db, payload.company_id, payload.month, payload.year, "environmental")
    db.commit()
    db.refresh(item)
    return item


@router.post("/social")
def save_social(
    payload: SocialCreate,
    db: Session = Depends(get_db),
    user: str = Depends(decode_token),
):
    replace_period_data(db, SocialData, payload.company_id, payload.month, payload.year)
    item = SocialData(**payload.model_dump())
    db.add(item)

    upsert_submission(db, payload.company_id, payload.month, payload.year, "social")
    db.commit()
    db.refresh(item)
    return item


@router.post("/governance")
def save_governance(
    payload: GovernanceCreate,
    db: Session = Depends(get_db),
    user: str = Depends(decode_token),
):
    replace_period_data(db, GovernanceData, payload.company_id, payload.month, payload.year)
    item = GovernanceData(**payload.model_dump())
    db.add(item)

    upsert_submission(db, payload.company_id, payload.month, payload.year, "governance")
    db.commit()
    db.refresh(item)
    return item
