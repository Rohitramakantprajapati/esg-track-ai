from datetime import datetime
from typing import Any, Dict, List

from pydantic import BaseModel, Field


class CompanyCreate(BaseModel):
    name: str
    industry: str
    size: int


class CompanyOut(CompanyCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EnvironmentalCreate(BaseModel):
    company_id: int
    month: int = Field(ge=1, le=12)
    year: int
    carbon_emissions_tonnes: float
    energy_kwh: float
    water_litres: float
    waste_kg: float
    recycled_waste_kg: float


class SocialCreate(BaseModel):
    company_id: int
    month: int = Field(ge=1, le=12)
    year: int
    total_employees: int
    female_employees: int
    safety_incidents: int
    training_hours: float
    community_investment: float


class GovernanceCreate(BaseModel):
    company_id: int
    month: int = Field(ge=1, le=12)
    year: int
    board_members: int
    independent_directors: int
    audit_meetings: int
    has_whistleblower_policy: bool
    data_breaches: int


class SensorCreate(BaseModel):
    company_id: int
    sensor_name: str
    api_endpoint: str
    api_key: str
    data_type: str
    is_active: bool = True


class SensorOut(SensorCreate):
    id: int

    class Config:
        from_attributes = True


class AuditorCommentCreate(BaseModel):
    company_id: int
    data_type: str
    data_id: int
    comment: str
    flagged: bool = False


class ColumnMappingImport(BaseModel):
    company_id: int
    month: int = Field(ge=1, le=12)
    year: int
    data_type: str
    mapping: Dict[str, str]
    rows: List[Dict[str, Any]]


class AlertOut(BaseModel):
    id: int
    severity: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
