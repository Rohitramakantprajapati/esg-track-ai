from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EnvironmentalData, GovernanceData, SocialData, Submission
from app.schemas import EnvironmentalCreate, GovernanceCreate, SocialCreate

router = APIRouter(prefix="/data", tags=["data"])


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


@router.post("/environmental")
def save_environmental(payload: EnvironmentalCreate, db: Session = Depends(get_db)):
    item = (
        db.query(EnvironmentalData)
        .filter(
            EnvironmentalData.company_id == payload.company_id,
            EnvironmentalData.month == payload.month,
            EnvironmentalData.year == payload.year,
        )
        .one_or_none()
    )
    if item:
        for k, v in payload.model_dump().items():
            setattr(item, k, v)
    else:
        item = EnvironmentalData(**payload.model_dump())
        db.add(item)

    upsert_submission(db, payload.company_id, payload.month, payload.year, "environmental")
    db.commit()
    db.refresh(item)
    return item


@router.post("/social")
def save_social(payload: SocialCreate, db: Session = Depends(get_db)):
    item = (
        db.query(SocialData)
        .filter(
            SocialData.company_id == payload.company_id,
            SocialData.month == payload.month,
            SocialData.year == payload.year,
        )
        .one_or_none()
    )
    if item:
        for k, v in payload.model_dump().items():
            setattr(item, k, v)
    else:
        item = SocialData(**payload.model_dump())
        db.add(item)

    upsert_submission(db, payload.company_id, payload.month, payload.year, "social")
    db.commit()
    db.refresh(item)
    return item


@router.post("/governance")
def save_governance(payload: GovernanceCreate, db: Session = Depends(get_db)):
    item = (
        db.query(GovernanceData)
        .filter(
            GovernanceData.company_id == payload.company_id,
            GovernanceData.month == payload.month,
            GovernanceData.year == payload.year,
        )
        .one_or_none()
    )
    if item:
        for k, v in payload.model_dump().items():
            setattr(item, k, v)
    else:
        item = GovernanceData(**payload.model_dump())
        db.add(item)

    upsert_submission(db, payload.company_id, payload.month, payload.year, "governance")
    db.commit()
    db.refresh(item)
    return item
