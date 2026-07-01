import io
import json

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Company, EnvironmentalData, GovernanceData, SocialData
from app.routers.data import upsert_submission
from app.schemas import ColumnMappingImport

router = APIRouter(prefix="/upload", tags=["upload"])

TYPE_FIELDS = {
    "environmental": {
        "carbon_emissions_tonnes",
        "energy_kwh",
        "water_litres",
        "waste_kg",
        "recycled_waste_kg",
    },
    "social": {
        "total_employees",
        "female_employees",
        "safety_incidents",
        "training_hours",
        "community_investment",
    },
    "governance": {
        "board_members",
        "independent_directors",
        "audit_meetings",
        "has_whistleblower_policy",
        "data_breaches",
    },
}


@router.post("/csv")
async def preview_csv(file: UploadFile = File(...)):
    name = file.filename.lower()
    content = await file.read()
    try:
        if name.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif name.endswith(".xlsx") or name.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Only CSV or Excel files are supported")
    except HTTPException:
        # re-raise known HTTPException for unsupported types
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse uploaded file: {str(exc)}")

    df = df.fillna("")
    preview = df.head(20).to_dict(orient="records")
    return {
        "columns": list(df.columns),
        "rows": preview,
        "total_rows": int(df.shape[0]),
    }


def to_float(value):
    if value in (None, ""):
        return 0.0
    return float(value)


def to_int(value):
    if value in (None, ""):
        return 0
    return int(float(value))


def detect_data_type_from_mapping(mapping: dict[str, str]) -> str:
    mapped_targets = {target for target in mapping.values() if target}
    if not mapped_targets:
        return "others"

    best_type = "others"
    best_score = 0
    for data_type, fields in TYPE_FIELDS.items():
        score = len(mapped_targets & fields)
        if score > best_score:
            best_type = data_type
            best_score = score

    return best_type if best_score > 0 else "others"


@router.post("/import")
def import_mapped_data(payload: ColumnMappingImport, db: Session = Depends(get_db)):
    # delegate to helper that supports both JSON and file-based imports
    payload_mapping = payload.mapping
    return process_import_rows(db, payload.company_id, payload.month, payload.year, payload.data_type, payload_mapping, payload.rows)


def delete_existing_period_data(db: Session, model, company_id: int, month: int, year: int):
    db.query(model).filter(
        model.company_id == company_id,
        model.month == month,
        model.year == year,
    ).delete(synchronize_session=False)


def process_import_rows(db: Session, default_company_id: int, month: int, year: int, data_type: str, mapping: dict, rows: list):
    # determine actual type if user selected 'others'
    selected_type = data_type
    if selected_type == "others":
        selected_type = detect_data_type_from_mapping(mapping)

    if selected_type not in {"environmental", "social", "governance"}:
        upsert_submission(db, default_company_id, month, year, "others")
        db.commit()
        return {
            "imported_records": len(rows),
            "stored_records": 0,
            "data_type": "others",
            "message": "No supported ESG columns found. Saved as 'others' submission.",
        }

    try:
        imported = 0
        companies_used = set()
        cleared_company_types = set()
        for row in rows:
            mapped = {}
            for source_col, target_col in mapping.items():
                if target_col:
                    mapped[target_col] = row.get(source_col)

            # resolve company for this row: prefer mapped/company column in row, fallback to default_company_id
            company_for_row = default_company_id
            candidate = mapped.get('company_id') or row.get('company_id')
            if candidate:
                try:
                    cid = int(candidate)
                    exists = db.query(Company).filter(Company.id == cid).one_or_none()
                    if exists:
                        company_for_row = cid
                except Exception:
                    # try exact name match first, then case-insensitive contains
                    found = db.query(Company).filter(Company.name == str(candidate)).one_or_none()
                    if not found:
                        found = db.query(Company).filter(Company.name.ilike(f"%{str(candidate)}%"))
                        found = found.one_or_none()
                    if found:
                        company_for_row = found.id
                    else:
                        # attempt to create; handle unique-constraint races by retrying lookup
                        try:
                            newc = Company(name=str(candidate), industry="Unknown", size=0)
                            db.add(newc)
                            db.flush()
                            company_for_row = newc.id
                        except Exception:
                            db.rollback()
                            found = db.query(Company).filter(Company.name == str(candidate)).one_or_none()
                            if found:
                                company_for_row = found.id
                            else:
                                # fallback to default
                                company_for_row = default_company_id

            if selected_type == "environmental":
                if (company_for_row, "environmental") not in cleared_company_types:
                    delete_existing_period_data(db, EnvironmentalData, company_for_row, month, year)
                    cleared_company_types.add((company_for_row, "environmental"))
                data = {
                    "company_id": company_for_row,
                    "month": month,
                    "year": year,
                    "carbon_emissions_tonnes": to_float(mapped.get("carbon_emissions_tonnes")),
                    "energy_kwh": to_float(mapped.get("energy_kwh")),
                    "water_litres": to_float(mapped.get("water_litres")),
                    "waste_kg": to_float(mapped.get("waste_kg")),
                    "recycled_waste_kg": to_float(mapped.get("recycled_waste_kg")),
                }
                db.add(EnvironmentalData(**data))
                db.flush()
                upsert_submission(db, company_for_row, month, year, "environmental")
                companies_used.add(company_for_row)

            elif selected_type == "social":
                if (company_for_row, "social") not in cleared_company_types:
                    delete_existing_period_data(db, SocialData, company_for_row, month, year)
                    cleared_company_types.add((company_for_row, "social"))
                data = {
                    "company_id": company_for_row,
                    "month": month,
                    "year": year,
                    "total_employees": to_int(mapped.get("total_employees")),
                    "female_employees": to_int(mapped.get("female_employees")),
                    "safety_incidents": to_int(mapped.get("safety_incidents")),
                    "training_hours": to_float(mapped.get("training_hours")),
                    "community_investment": to_float(mapped.get("community_investment")),
                }
                db.add(SocialData(**data))
                db.flush()
                upsert_submission(db, company_for_row, month, year, "social")
                companies_used.add(company_for_row)

            elif selected_type == "governance":
                if (company_for_row, "governance") not in cleared_company_types:
                    delete_existing_period_data(db, GovernanceData, company_for_row, month, year)
                    cleared_company_types.add((company_for_row, "governance"))
                whistle = str(mapped.get("has_whistleblower_policy", "")).lower() in {
                    "1",
                    "true",
                    "yes",
                    "y",
                }
                data = {
                    "company_id": company_for_row,
                    "month": month,
                    "year": year,
                    "board_members": to_int(mapped.get("board_members")),
                    "independent_directors": to_int(mapped.get("independent_directors")),
                    "audit_meetings": to_int(mapped.get("audit_meetings")),
                    "has_whistleblower_policy": whistle,
                    "data_breaches": to_int(mapped.get("data_breaches")),
                }
                db.add(GovernanceData(**data))
                db.flush()
                upsert_submission(db, company_for_row, month, year, "governance")
                companies_used.add(company_for_row)

            imported += 1

        db.commit()
        return {"imported_records": imported, "stored_records": imported, "data_type": selected_type, "companies": list(companies_used)}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(exc)}")


@router.post('/import-file')
async def import_file(file: UploadFile = File(...), mapping: str = Form(...), data_type: str = Form(...), month: int = Form(...), year: int = Form(...), company_id: int = Form(0), db: Session = Depends(get_db)):
    """Upload a CSV/XLSX and import all rows server-side.
    - `mapping` must be a JSON object string mapping source columns to target fields.
    - `data_type`, `month`, `year` are required. `company_id` is optional (used as default).
    """
    content = await file.read()
    name = file.filename.lower()
    try:
        if name.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif name.endswith('.xlsx') or name.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail='Only CSV or Excel files are supported')
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f'Could not parse uploaded file: {str(exc)}')

    df = df.fillna("")
    try:
        mapping_obj = json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid mapping JSON')

    rows = df.to_dict(orient='records')
    return process_import_rows(db, company_id or 0, month, year, data_type, mapping_obj, rows)
