"""The backend URL should open the built demo and keep suggestion requests working."""

import re

import pytest
from fastapi.testclient import TestClient

from backend import main


@pytest.mark.skipif(not (main.FRONTEND_DIST / "index.html").exists(),
                    reason="Run npm run build for the frontend asset integration check")
def test_backend_serves_frontend_and_its_assets():
    client = TestClient(main.app)
    response = client.get("/")
    assert response.status_code == 200
    assert '<div id="root"></div>' in response.text
    assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', response.text)
    assert assets
    for asset in assets:
        assert client.get(asset).status_code == 200


def test_missing_build_explains_how_to_start(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "FRONTEND_DIST", tmp_path)
    response = TestClient(main.app).get("/")
    assert response.status_code == 503
    assert "npm run build" in response.text
    assert "http://localhost:5173" in response.text


def test_frontend_does_not_hide_api_routes():
    client = TestClient(main.app)
    response = client.post("/api/suggest", json={"notes": [
        {"pitch": 60, "time": 0, "duration": 1, "velocity": 80},
    ]})
    assert response.status_code == 200
    assert response.json()["ghosts"]
    assert client.get("/api/does-not-exist").status_code == 404
