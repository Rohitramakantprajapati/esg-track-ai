from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AuditorComment,
    Company,
    EnvironmentalData,
    GovernanceData,
    SocialData,
    Submission,
)
from app.schemas import AuditorCommentCreate

router = APIRouter(prefix="/auditor", tags=["auditor"])


@router.post("/comment")
def save_comment(payload: AuditorCommentCreate, db: Session = Depends(get_db)):
    comment = AuditorComment(**payload.model_dump())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.put("/approve/{submission_id}")
def approve_submission(submission_id: int, db: Session = Depends(get_db)):
    submission = db.query(Submission).filter(Submission.id == submission_id).one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    submission.status = "approved"
    db.commit()
    return {"message": "Submission approved"}


@router.get("/trail/{company_id}")
def audit_trail(company_id: int, db: Session = Depends(get_db)):
    return (
        db.query(AuditorComment)
        .filter(AuditorComment.company_id == company_id)
        .order_by(AuditorComment.created_at.desc())
        .all()
    )


@router.get("/submissions")
def list_submissions(db: Session = Depends(get_db)):
    rows = (
        db.query(Submission, Company)
        .join(Company, Company.id == Submission.company_id)
        .order_by(Submission.submission_date.desc())
        .all()
    )
    return [
        {
            "id": sub.id,
            "company_id": sub.company_id,
            "company_name": comp.name,
            "month": sub.month,
            "year": sub.year,
            "data_type": sub.data_type,
            "status": sub.status,
            "submission_date": sub.submission_date,
        }
        for sub, comp in rows
    ]


@router.get("/submission/{submission_id}")
def get_submission_detail(submission_id: int, db: Session = Depends(get_db)):
    sub = db.query(Submission).filter(Submission.id == submission_id).one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    if sub.data_type == "environmental":
        payload = (
            db.query(EnvironmentalData)
            .filter(
                EnvironmentalData.company_id == sub.company_id,
                EnvironmentalData.month == sub.month,
                EnvironmentalData.year == sub.year,
            )
            .one_or_none()
        )
    elif sub.data_type == "social":
        payload = (
            db.query(SocialData)
            .filter(
                SocialData.company_id == sub.company_id,
                SocialData.month == sub.month,
                SocialData.year == sub.year,
            )
            .one_or_none()
        )
    elif sub.data_type == "governance":
        payload = (
            db.query(GovernanceData)
            .filter(
                GovernanceData.company_id == sub.company_id,
                GovernanceData.month == sub.month,
                GovernanceData.year == sub.year,
            )
            .one_or_none()
        )
    else:
        payload = None

    return {
        "submission": {
            "id": sub.id,
            "company_id": sub.company_id,
            "month": sub.month,
            "year": sub.year,
            "data_type": sub.data_type,
            "status": sub.status,
        },
        "raw_data": (
            {k: v for k, v in payload.__dict__.items() if not k.startswith("_")} if payload else {}
        ),
    }
