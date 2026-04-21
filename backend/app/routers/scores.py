from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Company, EnvironmentalData, GovernanceData, SocialData
from app.services.scoring import (
    BENCHMARKS,
    environmental_score,
    governance_score,
    rating_from_score,
    social_score,
    total_esg_score,
)

router = APIRouter(prefix="/scores", tags=["scores"])


def compute_monthly_scores(company_id: int, db: Session):
    env_items = db.query(EnvironmentalData).filter(EnvironmentalData.company_id == company_id).all()
    social_items = db.query(SocialData).filter(SocialData.company_id == company_id).all()
    gov_items = db.query(GovernanceData).filter(GovernanceData.company_id == company_id).all()

    env_map = {(x.year, x.month): x for x in env_items}
    social_map = {(x.year, x.month): x for x in social_items}
    gov_map = {(x.year, x.month): x for x in gov_items}

    keys = sorted(set(env_map.keys()) & set(social_map.keys()) & set(gov_map.keys()))
    results = []
    for year, month in keys:
        env = env_map[(year, month)]
        soc = social_map[(year, month)]
        gov = gov_map[(year, month)]
        e_parts = environmental_score(env, soc)
        s_parts = social_score(soc)
        g_parts = governance_score(gov)
        total = total_esg_score(e_parts["e_score"], s_parts["s_score"], g_parts["g_score"])
        results.append(
            {
                "year": year,
                "month": month,
                "e_score": e_parts["e_score"],
                "s_score": s_parts["s_score"],
                "g_score": g_parts["g_score"],
                "total_score": total,
                "rating": rating_from_score(total),
                "components": {**e_parts, **s_parts, **g_parts},
                "raw": {
                    "environmental": {
                        "carbon_emissions_tonnes": env.carbon_emissions_tonnes,
                        "energy_kwh": env.energy_kwh,
                        "water_litres": env.water_litres,
                        "waste_kg": env.waste_kg,
                        "recycled_waste_kg": env.recycled_waste_kg,
                    },
                    "social": {
                        "total_employees": soc.total_employees,
                        "female_employees": soc.female_employees,
                        "safety_incidents": soc.safety_incidents,
                        "training_hours": soc.training_hours,
                        "community_investment": soc.community_investment,
                    },
                    "governance": {
                        "board_members": gov.board_members,
                        "independent_directors": gov.independent_directors,
                        "audit_meetings": gov.audit_meetings,
                        "has_whistleblower_policy": gov.has_whistleblower_policy,
                        "data_breaches": gov.data_breaches,
                    },
                },
            }
        )

    return results


@router.get("/{company_id}")
def get_scores(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    scores = compute_monthly_scores(company_id, db)
    if not scores:
        return {
            "company_id": company_id,
            "company_name": company.name,
            "monthly_scores": [],
            "current": None,
            "quick_stats": {},
            "benchmarks": BENCHMARKS,
        }

    current = scores[-1]
    current_year = datetime.utcnow().year

    env_year = db.query(EnvironmentalData).filter(
        EnvironmentalData.company_id == company_id, EnvironmentalData.year == current_year
    )
    total_carbon = round(sum(x.carbon_emissions_tonnes for x in env_year), 2)

    env_items = env_year.all()
    social_by_month = {
        (x.year, x.month): x
        for x in db.query(SocialData).filter(
            SocialData.company_id == company_id,
            SocialData.year == current_year,
        )
    }
    water_saved = 0.0
    for env in env_items:
        soc = social_by_month.get((env.year, env.month))
        if not soc:
            continue
        benchmark_water = BENCHMARKS["water"] * max(1, soc.total_employees)
        water_saved += max(0.0, benchmark_water - env.water_litres)

    latest_social = db.query(SocialData).filter(SocialData.company_id == company_id).order_by(
        SocialData.year.desc(), SocialData.month.desc()
    ).first()
    latest_gov = db.query(GovernanceData).filter(GovernanceData.company_id == company_id).order_by(
        GovernanceData.year.desc(), GovernanceData.month.desc()
    ).first()

    safety_score = max(0.0, 100 - (latest_social.safety_incidents * 10)) if latest_social else 0.0
    board_diversity = (
        round((latest_gov.independent_directors / max(1, latest_gov.board_members)) * 100, 2)
        if latest_gov
        else 0.0
    )

    return {
        "company_id": company_id,
        "company_name": company.name,
        "monthly_scores": scores,
        "current": current,
        "quick_stats": {
            "total_carbon_this_year": total_carbon,
            "water_saved": round(water_saved, 2),
            "safety_score": round(safety_score, 2),
            "board_diversity_pct": board_diversity,
        },
        "benchmarks": BENCHMARKS,
    }
