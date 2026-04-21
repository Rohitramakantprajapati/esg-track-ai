from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Company
from app.schemas import CompanyCreate

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("")
def list_companies(db: Session = Depends(get_db)):
    return db.query(Company).order_by(Company.name.asc()).all()


@router.post("")
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    company = Company(**payload.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company
