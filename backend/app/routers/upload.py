import io
import json

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EnvironmentalData, GovernanceData, SocialData
from app.routers.data import upsert_submission
from app.schemas import ColumnMappingImport

router = APIRouter(prefix="/upload", tags=["upload"])


def _parse_json_records(content: bytes):
    obj = json.loads(content.decode("utf-8-sig"))
    if isinstance(obj, list):
        return pd.json_normalize(obj)
    if isinstance(obj, dict):
        if isinstance(obj.get("data"), list):
            return pd.json_normalize(obj["data"])
        return pd.json_normalize([obj])
    raise ValueError("Unsupported JSON structure")


def _parse_dataset(name: str, content: bytes):
    lower_name = (name or "uploaded_file").lower()

    if lower_name.endswith(".xlsx") or lower_name.endswith(".xls"):
        return pd.read_excel(io.BytesIO(content)), "excel"

    if lower_name.endswith(".json"):
        return _parse_json_records(content), "json"

    if lower_name.endswith(".jsonl") or lower_name.endswith(".ndjson"):
        return pd.read_json(io.BytesIO(content), lines=True), "jsonl"

    if lower_name.endswith(".tsv"):
        return pd.read_csv(io.BytesIO(content), sep="\t"), "tsv"

    if lower_name.endswith(".txt"):
        return pd.read_csv(io.BytesIO(content), sep=None, engine="python"), "txt-delimited"

    if lower_name.endswith(".csv"):
        return pd.read_csv(io.BytesIO(content)), "csv"

    parse_attempts = [
        ("excel", lambda: pd.read_excel(io.BytesIO(content))),
        ("json", lambda: _parse_json_records(content)),
        ("jsonl", lambda: pd.read_json(io.BytesIO(content), lines=True)),
        ("delimited", lambda: pd.read_csv(io.BytesIO(content), sep=None, engine="python")),
    ]

    for fmt, parser in parse_attempts:
        try:
            return parser(), fmt
        except Exception:
            continue

    raise HTTPException(
        status_code=400,
        detail=(
            "Unsupported dataset format. Supported formats: CSV, TSV, TXT (delimited), "
            "Excel (.xlsx/.xls), JSON, JSONL/NDJSON."
        ),
    )


def _clean_preview_df(df: pd.DataFrame):
    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="No tabular rows found in the uploaded file")

    safe = df.copy()
    safe.columns = [str(col) for col in safe.columns]
    safe = safe.fillna("")

    for col in safe.columns:
        safe[col] = safe[col].apply(
            lambda value: json.dumps(value)
            if isinstance(value, (dict, list))
            else value
        )

    return safe


@router.post("/csv")
async def preview_csv(file: UploadFile = File(...)):
    name = file.filename or "uploaded_file"
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        raw_df, parsed_format = _parse_dataset(name, content)
        df = _clean_preview_df(raw_df)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to parse uploaded data: {str(exc)}")

    all_rows = df.to_dict(orient="records")
    preview = df.head(20).to_dict(orient="records")
    return {
        "detected_format": parsed_format,
        "columns": list(df.columns),
        "rows": all_rows,
        "preview_rows": preview,
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


@router.post("/import")
def import_mapped_data(payload: ColumnMappingImport, db: Session = Depends(get_db)):
    imported = 0
    for row in payload.rows:
        mapped = {}
        for source_col, target_col in payload.mapping.items():
            mapped[target_col] = row.get(source_col)

        if payload.data_type == "environmental":
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

        elif payload.data_type == "social":
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

        elif payload.data_type == "governance":
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
    return {"imported_records": imported}
