from datetime import datetime

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EnvironmentalData, SensorConnection, SocialData
from app.routers.data import upsert_submission
from app.schemas import SensorCreate

router = APIRouter(prefix="/sensors", tags=["sensors"])


def _pull_and_apply_sensor(sensor: SensorConnection, db: Session):
    try:
        resp = requests.get(
            sensor.api_endpoint,
            headers={"x-api-key": sensor.api_key},
            timeout=8,
        )
        resp.raise_for_status()
        payload = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        value = float(payload.get("value", 0))
        sensor.is_active = True
    except Exception as exc:
        sensor.is_active = False
        db.commit()
        return {"ok": False, "sensor_id": sensor.id, "message": f"Pull failed: {str(exc)}"}

    now = datetime.utcnow()
    month, year = now.month, now.year

    env = (
        db.query(EnvironmentalData)
        .filter(
            EnvironmentalData.company_id == sensor.company_id,
            EnvironmentalData.month == month,
            EnvironmentalData.year == year,
        )
        .one_or_none()
    )
    social = (
        db.query(SocialData)
        .filter(
            SocialData.company_id == sensor.company_id,
            SocialData.month == month,
            SocialData.year == year,
        )
        .one_or_none()
    )
    if not social:
        social = SocialData(
            company_id=sensor.company_id,
            month=month,
            year=year,
            total_employees=1,
            female_employees=0,
            safety_incidents=0,
            training_hours=0,
            community_investment=0,
        )
        db.add(social)

    if not env:
        env = EnvironmentalData(
            company_id=sensor.company_id,
            month=month,
            year=year,
            carbon_emissions_tonnes=0,
            energy_kwh=0,
            water_litres=0,
            waste_kg=0,
            recycled_waste_kg=0,
        )
        db.add(env)

    if sensor.data_type == "carbon":
        env.carbon_emissions_tonnes = value
    elif sensor.data_type == "energy":
        env.energy_kwh = value
    elif sensor.data_type == "water":
        env.water_litres = value
    elif sensor.data_type == "waste":
        env.waste_kg = value

    upsert_submission(db, sensor.company_id, month, year, "environmental")
    upsert_submission(db, sensor.company_id, month, year, "social")
    db.commit()
    return {"ok": True, "sensor_id": sensor.id, "value": value, "message": "Latest reading pulled"}


@router.post("")
def save_sensor(payload: SensorCreate, db: Session = Depends(get_db)):
    sensor = SensorConnection(**payload.model_dump())
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return sensor


@router.get("/{company_id}")
def list_sensors(company_id: int, db: Session = Depends(get_db)):
    return (
        db.query(SensorConnection)
        .filter(SensorConnection.company_id == company_id)
        .order_by(SensorConnection.id.desc())
        .all()
    )


@router.post("/test/{sensor_id}")
def test_sensor(sensor_id: int, db: Session = Depends(get_db)):
    sensor = db.query(SensorConnection).filter(SensorConnection.id == sensor_id).one_or_none()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    try:
        resp = requests.get(
            sensor.api_endpoint,
            headers={"x-api-key": sensor.api_key},
            timeout=5,
        )
        ok = resp.status_code < 400
        sensor.is_active = ok
        db.commit()
        return {
            "ok": ok,
            "status_code": resp.status_code,
            "message": "Connection successful" if ok else "Connection failed",
        }
    except Exception as exc:
        sensor.is_active = False
        db.commit()
        return {"ok": False, "status_code": 0, "message": f"Connection failed: {str(exc)}"}


@router.post("/pull/{sensor_id}")
def pull_sensor_data(sensor_id: int, db: Session = Depends(get_db)):
    sensor = db.query(SensorConnection).filter(SensorConnection.id == sensor_id).one_or_none()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    result = _pull_and_apply_sensor(sensor, db)
    if not result["ok"]:
        raise HTTPException(status_code=502, detail=result["message"])
    return {"message": result["message"], "value": result["value"]}


@router.post("/pull/company/{company_id}")
def pull_company_sensors(company_id: int, db: Session = Depends(get_db)):
    sensors = (
        db.query(SensorConnection)
        .filter(
            SensorConnection.company_id == company_id,
            SensorConnection.is_active.is_(True),
        )
        .all()
    )

    if not sensors:
        return {"pulled": 0, "succeeded": 0, "failed": 0, "results": []}

    results = [_pull_and_apply_sensor(sensor, db) for sensor in sensors]
    succeeded = sum(1 for item in results if item["ok"])
    failed = len(results) - succeeded
    return {"pulled": len(results), "succeeded": succeeded, "failed": failed, "results": results}
