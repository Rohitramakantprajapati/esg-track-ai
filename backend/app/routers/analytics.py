from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Company
from app.routers.scores import compute_monthly_scores
from app.services.analytics import build_gap_analysis, build_recommendations

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/{company_id}")
def get_analytics(
    company_id: int,
    start_year: int | None = Query(default=None),
    start_month: int | None = Query(default=None),
    end_year: int | None = Query(default=None),
    end_month: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    monthly = compute_monthly_scores(company_id, db)
    if not monthly:
        return {
            "company": company.name,
            "breakdown": {},
            "gap_analysis": [],
            "recommendations": [],
            "peer_comparison": [],
            "trend_table": [],
        }

    if start_year and start_month and end_year and end_month:
        monthly = [
            m
            for m in monthly
            if (m["year"], m["month"]) >= (start_year, start_month)
            and (m["year"], m["month"]) <= (end_year, end_month)
        ]

    current = monthly[-1]
    gap_analysis = build_gap_analysis(
        type("Env", (), current["raw"]["environmental"]),
        type("Soc", (), current["raw"]["social"]),
        type("Gov", (), current["raw"]["governance"]),
    )
    recommendations = build_recommendations(gap_analysis)

    peers = db.query(Company).filter(Company.industry == company.industry).all()
    peer_scores = []
    for peer in peers:
        ms = compute_monthly_scores(peer.id, db)
        if ms:
            peer_scores.append(ms[-1]["total_score"])
    industry_avg = round(sum(peer_scores) / max(1, len(peer_scores)), 2)
    top_performer = round(max(peer_scores), 2) if peer_scores else 0.0

    trend = []
    for i, row in enumerate(monthly):
        prev = monthly[i - 1] if i > 0 else None
        delta = round(row["total_score"] - prev["total_score"], 2) if prev else 0.0
        pct = round((delta / prev["total_score"]) * 100, 2) if prev and prev["total_score"] else 0.0
        trend.append(
            {
                "year": row["year"],
                "month": row["month"],
                "score": row["total_score"],
                "change": delta,
                "change_pct": pct,
                "direction": "up" if delta >= 0 else "down",
            }
        )

    return {
        "company": company.name,
        "breakdown": {
            "e_score": current["e_score"],
            "s_score": current["s_score"],
            "g_score": current["g_score"],
            "total_score": current["total_score"],
        },
        "gap_analysis": gap_analysis,
        "recommendations": recommendations,
        "peer_comparison": [
            {"label": "Your Company", "score": current["total_score"]},
            {"label": "Industry Average", "score": industry_avg},
            {"label": "Top Performer", "score": top_performer},
        ],
        "trend_table": trend,
    }
