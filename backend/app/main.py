from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, SessionLocal, engine
from app.routers import alerts, analytics, auditor, companies, data, reports, scores, sensors, upload
from app.utils.seed import seed_sample_data

app = FastAPI(title="ESG Track API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_sample_data(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(companies.router)
app.include_router(data.router)
app.include_router(scores.router)
app.include_router(analytics.router)
app.include_router(upload.router)
app.include_router(sensors.router)
app.include_router(auditor.router)
app.include_router(reports.router)
app.include_router(alerts.router)
