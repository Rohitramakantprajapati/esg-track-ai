# ESG Track - ESG Compliance Web Application

Production-style ESG compliance web platform built with React, FastAPI, and PostgreSQL.

## Tech Stack
- Frontend: React + Vite + Recharts
- Backend: Python FastAPI
- Database: PostgreSQL + SQLAlchemy ORM
- PDF reports: ReportLab

## Project Structure
- backend: FastAPI application
- frontend: React web app
- database_setup.sql: SQL schema (core + supporting workflow tables)
- requirements.txt: Python dependencies
- .env.example: environment template
- run.sh: starts backend + frontend

## 1. Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

## 2. Database Setup
1. Create database:
   - `createdb esg_track` (or use pgAdmin)
2. Apply schema:
   - `psql -U postgres -d esg_track -f database_setup.sql`

## 3. Backend Setup
1. Create virtual environment:
   - Windows PowerShell: `python -m venv .venv`
   - Activate: `.\.venv\Scripts\Activate.ps1`
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Configure environment:
   - Copy `.env.example` to `.env`
4. Start backend:
   - `cd backend`
   - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

## 4. Frontend Setup
1. Install dependencies:
   - `cd frontend`
   - `npm install`
2. Optional env file:
   - create `frontend/.env` with `VITE_API_BASE_URL=http://localhost:8000`
3. Start frontend:
   - `npm run dev`

## 5. Run Both Together
- On bash-compatible shell:
  - `bash run.sh`

## Seed Data
On first backend startup, sample data is auto-seeded:
- TechCorp India
- Green Manufacturing Ltd
- Retail Solutions Pvt Ltd

Each includes 6 months of environmental, social, and governance data.

## Main API Endpoints
- `GET /companies`
- `POST /companies`
- `POST /data/environmental`
- `POST /data/social`
- `POST /data/governance`
- `GET /scores/{company_id}`
- `GET /analytics/{company_id}`
- `POST /upload/csv`
- `POST /upload/import`
- `POST /sensors`
- `GET /sensors/{company_id}`
- `POST /sensors/test/{sensor_id}`
- `POST /auditor/comment`
- `PUT /auditor/approve/{submission_id}`
- `GET /auditor/trail/{company_id}`
- `GET /reports/generate/{company_id}/{month}/{year}`
- `GET /alerts/{company_id}`

## Notes
- No authentication is enabled (open access by design).
- CORS is open to simplify local integration.
- Report history, submission workflow, and alerts include supporting backend tables.
