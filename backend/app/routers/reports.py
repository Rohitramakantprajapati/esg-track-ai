from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Company, GeneratedReport
from app.routers.scores import compute_monthly_scores
from app.services.analytics import build_gap_analysis, build_recommendations

router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_DIR = Path(__file__).resolve().parents[2] / "generated_reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/generate/{company_id}/{month}/{year}")
def generate_report(company_id: int, month: int, year: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    monthly = compute_monthly_scores(company_id, db)
    score_row = next((m for m in monthly if m["month"] == month and m["year"] == year), None)
    if not score_row:
        raise HTTPException(status_code=404, detail="No ESG data for selected period")

    gap_analysis = build_gap_analysis(
        type("Env", (), score_row["raw"]["environmental"]),
        type("Soc", (), score_row["raw"]["social"]),
        type("Gov", (), score_row["raw"]["governance"]),
    )
    recommendations = build_recommendations(gap_analysis)

    file_name = f"esg_report_{company_id}_{year}_{month:02d}.pdf"
    file_path = REPORT_DIR / file_name

    c = canvas.Canvas(str(file_path), pagesize=A4)
    width, height = A4

    c.setFillColor(colors.HexColor("#1A5C38"))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(40, height - 60, "ESG Compliance Report")

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 11)
    c.drawString(40, height - 90, f"Company: {company.name}")
    c.drawString(40, height - 108, f"Period: {month:02d}/{year}")

    y = height - 145
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, "ESG Scorecard")
    y -= 24

    c.setFont("Helvetica", 11)
    c.drawString(40, y, f"Environmental Score: {score_row['e_score']}")
    y -= 18
    c.drawString(40, y, f"Social Score: {score_row['s_score']}")
    y -= 18
    c.drawString(40, y, f"Governance Score: {score_row['g_score']}")
    y -= 18
    c.drawString(40, y, f"Final ESG Score: {score_row['total_score']} ({score_row['rating']})")

    y -= 35
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, "Environmental Analysis")
    y -= 22
    c.setFont("Helvetica", 10)
    for key, val in score_row["raw"]["environmental"].items():
        c.drawString(50, y, f"{key.replace('_', ' ').title()}: {val}")
        y -= 16

    y -= 10
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, "Social Analysis")
    y -= 22
    c.setFont("Helvetica", 10)
    for key, val in score_row["raw"]["social"].items():
        c.drawString(50, y, f"{key.replace('_', ' ').title()}: {val}")
        y -= 16

    y -= 10
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, "Governance Analysis")
    y -= 22
    c.setFont("Helvetica", 10)
    for key, val in score_row["raw"]["governance"].items():
        c.drawString(50, y, f"{key.replace('_', ' ').title()}: {val}")
        y -= 16

    c.showPage()
    y = height - 60
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, "Recommendations")
    y -= 24
    c.setFont("Helvetica", 10)
    for rec in recommendations[:8]:
        c.drawString(45, y, f"- {rec['recommendation']} ({rec['estimated_impact']})")
        y -= 16

    y -= 20
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, "Auditor Sign-off")
    y -= 24
    c.setFont("Helvetica", 11)
    c.drawString(45, y, "Reviewed by: ____________________")
    y -= 18
    c.drawString(45, y, "Date: ____________________")

    c.save()

    existing = (
        db.query(GeneratedReport)
        .filter(
            GeneratedReport.company_id == company_id,
            GeneratedReport.month == month,
            GeneratedReport.year == year,
        )
        .one_or_none()
    )
    if not existing:
        db.add(
            GeneratedReport(
                company_id=company_id,
                month=month,
                year=year,
                file_name=file_name,
            )
        )
        db.commit()

    return FileResponse(path=file_path, filename=file_name, media_type="application/pdf")


@router.get("/history/{company_id}")
def report_history(company_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(GeneratedReport)
        .filter(GeneratedReport.company_id == company_id)
        .order_by(GeneratedReport.generated_at.desc())
        .all()
    )
    return rows
