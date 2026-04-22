import io

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EnvironmentalData, GovernanceData, SocialData
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

    if name.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    elif name.endswith(".xlsx") or name.endswith(".xls"):
        df = pd.read_excel(io.BytesIO(content))
    else:
        raise HTTPException(status_code=400, detail="Only CSV or Excel files are supported")

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
    selected_type = payload.data_type
    if selected_type == "others":
        selected_type = detect_data_type_from_mapping(payload.mapping)

    if selected_type not in {"environmental", "social", "governance"}:
        upsert_submission(db, payload.company_id, payload.month, payload.year, "others")
        db.commit()
        return {
            "imported_records": len(payload.rows),
            "stored_records": 0,
            "data_type": "others",
            "message": "No supported ESG columns found. Saved as 'others' submission.",
        }

    imported = 0
    for row in payload.rows:
        mapped = {}
        for source_col, target_col in payload.mapping.items():
            if target_col:
                mapped[target_col] = row.get(source_col)

        if selected_type == "environmental":
            rec = (
                db.query(EnvironmentalData)
                .filter(
                    EnvironmentalData.company_id == payload.company_id,
                    EnvironmentalData.month == payload.month,
                    EnvironmentalData.year == payload.year,
                )
                .one_or_none()
            )
            data = {
                "company_id": payload.company_id,
                "month": payload.month,
                "year": payload.year,
                "carbon_emissions_tonnes": to_float(mapped.get("carbon_emissions_tonnes")),
                "energy_kwh": to_float(mapped.get("energy_kwh")),
                "water_litres": to_float(mapped.get("water_litres")),
                "waste_kg": to_float(mapped.get("waste_kg")),
                "recycled_waste_kg": to_float(mapped.get("recycled_waste_kg")),
            }
            if rec:
                for k, v in data.items():
                    setattr(rec, k, v)
            else:
                db.add(EnvironmentalData(**data))
            upsert_submission(db, payload.company_id, payload.month, payload.year, "environmental")

        elif selected_type == "social":
            rec = (
                db.query(SocialData)
                .filter(
                    SocialData.company_id == payload.company_id,
                    SocialData.month == payload.month,
                    SocialData.year == payload.year,
                )
                .one_or_none()
            )
            data = {
                "company_id": payload.company_id,
                "month": payload.month,
                "year": payload.year,
                "total_employees": to_int(mapped.get("total_employees")),
                "female_employees": to_int(mapped.get("female_employees")),
                "safety_incidents": to_int(mapped.get("safety_incidents")),
                "training_hours": to_float(mapped.get("training_hours")),
                "community_investment": to_float(mapped.get("community_investment")),
            }
            if rec:
                for k, v in data.items():
                    setattr(rec, k, v)
            else:
                db.add(SocialData(**data))
            upsert_submission(db, payload.company_id, payload.month, payload.year, "social")

        elif selected_type == "governance":
            rec = (
                db.query(GovernanceData)
                .filter(
                    GovernanceData.company_id == payload.company_id,
                    GovernanceData.month == payload.month,
                    GovernanceData.year == payload.year,
                )
                .one_or_none()
            )
            whistle = str(mapped.get("has_whistleblower_policy", "")).lower() in {
                "1",
                "true",
                "yes",
                "y",
            }
            data = {
                "company_id": payload.company_id,
                "month": payload.month,
                "year": payload.year,
                "board_members": to_int(mapped.get("board_members")),
                "independent_directors": to_int(mapped.get("independent_directors")),
                "audit_meetings": to_int(mapped.get("audit_meetings")),
                "has_whistleblower_policy": whistle,
                "data_breaches": to_int(mapped.get("data_breaches")),
            }
            if rec:
                for k, v in data.items():
                    setattr(rec, k, v)
            else:
                db.add(GovernanceData(**data))
            upsert_submission(db, payload.company_id, payload.month, payload.year, "governance")

        imported += 1

    db.commit()
    return {"imported_records": imported, "stored_records": imported, "data_type": selected_type}
