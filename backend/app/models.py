from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from .database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    industry = Column(String(150), nullable=False)
    size = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class EnvironmentalData(Base):
    __tablename__ = "environmental_data"
    __table_args__ = (UniqueConstraint("company_id", "month", "year", name="uq_env_company_month_year"),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    carbon_emissions_tonnes = Column(Float, nullable=False)
    energy_kwh = Column(Float, nullable=False)
    water_litres = Column(Float, nullable=False)
    waste_kg = Column(Float, nullable=False)
    recycled_waste_kg = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SocialData(Base):
    __tablename__ = "social_data"
    __table_args__ = (UniqueConstraint("company_id", "month", "year", name="uq_social_company_month_year"),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    total_employees = Column(Integer, nullable=False)
    female_employees = Column(Integer, nullable=False)
    safety_incidents = Column(Integer, nullable=False)
    training_hours = Column(Float, nullable=False)
    community_investment = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class GovernanceData(Base):
    __tablename__ = "governance_data"
    __table_args__ = (UniqueConstraint("company_id", "month", "year", name="uq_gov_company_month_year"),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    board_members = Column(Integer, nullable=False)
    independent_directors = Column(Integer, nullable=False)
    audit_meetings = Column(Integer, nullable=False)
    has_whistleblower_policy = Column(Boolean, nullable=False)
    data_breaches = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AuditorComment(Base):
    __tablename__ = "auditor_comments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    data_type = Column(String(50), nullable=False)
    data_id = Column(Integer, nullable=False)
    comment = Column(Text, nullable=False)
    flagged = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SensorConnection(Base):
    __tablename__ = "sensor_connections"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    sensor_name = Column(String(150), nullable=False)
    api_endpoint = Column(String(600), nullable=False)
    api_key = Column(String(255), nullable=False)
    data_type = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    data_type = Column(String(50), nullable=False)
    status = Column(String(20), default="pending", nullable=False)
    submission_date = Column(DateTime, default=datetime.utcnow, nullable=False)


class GeneratedReport(Base):
    __tablename__ = "generated_reports"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    file_name = Column(String(255), nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (UniqueConstraint("company_id", "source_key", name="uq_alert_company_source"),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    severity = Column(String(20), nullable=False)
    message = Column(String(600), nullable=False)
    source_key = Column(String(255), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
