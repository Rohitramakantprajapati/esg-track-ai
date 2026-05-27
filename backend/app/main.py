from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware

from auth import create_access_token, get_password_hash, verify_password
from app.database import Base, SessionLocal, engine
from app.routers import alerts, analytics, auditor, companies, data, reports, scores, sensors, upload
from app.utils.seed import seed_sample_data

app = FastAPI(title="ESG Track API", version="1.0.0")

FAKE_USERS = {
    "admin": {
        "username": "admin",
        # store plain password for tests; hashing/verification occurs on demand
        "password": "admin123",
    }
}

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


@app.post("/auth/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = FAKE_USERS.get(form_data.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # support either stored hashed_password or plain password for test convenience
    if "hashed_password" in user:
        valid = verify_password(form_data.password, user["hashed_password"])
    else:
        valid = form_data.password == user.get("password")

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": form_data.username})
    return {"access_token": access_token, "token_type": "bearer"}


app.include_router(companies.router)
app.include_router(data.router)
app.include_router(scores.router)
app.include_router(analytics.router)
app.include_router(upload.router)
app.include_router(sensors.router)
app.include_router(auditor.router)
app.include_router(reports.router)
app.include_router(alerts.router)
