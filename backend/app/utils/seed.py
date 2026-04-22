from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Company, EnvironmentalData, GovernanceData, SocialData, Submission


def seed_sample_data(db: Session):
    if db.query(Company).count() > 0:
        return

    companies = [
        Company(name="TechCorp India", industry="Technology", size=1200),
        Company(name="Green Manufacturing Ltd", industry="Manufacturing", size=2200),
        Company(name="Retail Solutions Pvt Ltd", industry="Retail", size=1600),
    ]
    db.add_all(companies)
    db.commit()

    today = datetime.utcnow()
    months = []
    m = today.month
    y = today.year
    for _ in range(6):
        months.append((m, y))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    months.reverse()

    companies = db.query(Company).all()
    for idx, company in enumerate(companies):
        base_emp = company.size
        for i, (month, year) in enumerate(months):
            env = EnvironmentalData(
                company_id=company.id,
                month=month,
                year=year,
                carbon_emissions_tonnes=420 + i * 10 + idx * 40,
                energy_kwh=base_emp * 820 + i * 1100 + idx * 2500,
                water_litres=base_emp * 3600 + i * 4800 + idx * 12000,
                waste_kg=base_emp * 90 + i * 200 + idx * 500,
                recycled_waste_kg=base_emp * 58 + i * 120 + idx * 300,
            )
            social = SocialData(
                company_id=company.id,
                month=month,
                year=year,
                total_employees=base_emp,
                female_employees=int(base_emp * (0.33 + (idx * 0.03) + i * 0.002)),
                safety_incidents=max(0, 4 - i + idx),
                training_hours=26 + i * 2 + idx,
                community_investment=base_emp * (1200 + i * 60 + idx * 90),
            )
            gov = GovernanceData(
                company_id=company.id,
                month=month,
                year=year,
                board_members=10 + idx,
                independent_directors=4 + (i % 2) + idx,
                audit_meetings=3 + (i % 3),
                has_whistleblower_policy=True if idx != 2 else i % 2 == 0,
                data_breaches=max(0, 2 - i // 2 + idx // 2),
            )
            db.add_all([env, social, gov])
            db.flush()

            db.add(
                Submission(
                    company_id=company.id,
                    month=month,
                    year=year,
                    data_type="environmental",
                    status="approved" if i < 4 else "pending",
                )
            )
            db.add(
                Submission(
                    company_id=company.id,
                    month=month,
                    year=year,
                    data_type="social",
                    status="approved" if i < 4 else "pending",
                )
            )
            db.add(
                Submission(
                    company_id=company.id,
                    month=month,
                    year=year,
                    data_type="governance",
                    status="approved" if i < 4 else "pending",
                )
            )

    db.commit()
