import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200


def test_list_companies():
    r = client.get("/companies")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_company():
    payload = {"name": "Test Corp", "industry": "Tech", "size": 100}
    r = client.post("/companies", json=payload)
    assert r.status_code in (200, 201)
    assert "id" in r.json()


def test_unauthorized_report():
    r = client.get("/reports/generate/1/1/2025")
    assert r.status_code == 401
