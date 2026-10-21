import pytest
from fastapi.testclient import TestClient
from datetime import date, timedelta


def test_hybrid_can_create_farm_and_post_job(client: TestClient):
    # Register Hybrid user
    res = client.post("/api/auth/register", json={
        "name": "Hybrid User One",
        "email": "hybrid1@example.com",
        "password": "Password123!",
        "role": "HYBRID",
        "phone": "+91 99000 11111",
    })
    assert res.status_code == 201
    token = res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Hybrid can register a farm
    res = client.post("/api/farms", json={
        "name": "Hybrid Farm",
        "area_acres": 4.5,
        "latitude": 13.62,
        "longitude": 79.40,
        "soil_info": "Red Loam",
    }, headers=headers)
    assert res.status_code == 201
    farm_id = res.json()["id"]

    # Hybrid can post a job
    res = client.post("/api/jobs", json={
        "farm_id": farm_id,
        "work_type": "Chilli Harvesting",
        "required_skill": "harvesting",
        "workers_required": 3,
        "start_date": str(date.today() + timedelta(days=2)),
        "duration_days": 4,
        "wage_per_day": 600.0,
    }, headers=headers)
    assert res.status_code == 201
    job_id = res.json()["id"]

    # Hybrid cannot apply to their OWN job
    apply_res = client.post(f"/api/jobs/{job_id}/apply", headers=headers)
    assert apply_res.status_code == 400
    assert "own job" in apply_res.json()["detail"].lower()


def test_hybrid_can_apply_to_other_farmers_jobs(client: TestClient):
    # Farmer creates a job
    farmer_res = client.post("/api/auth/register", json={
        "name": "Farmer Only",
        "email": "farmer.only@example.com",
        "password": "Password123!",
        "role": "FARMER",
        "phone": "+91 99000 22222",
    })
    assert farmer_res.status_code == 201
    farmer_token = farmer_res.json()["token"]
    f_headers = {"Authorization": f"Bearer {farmer_token}"}

    farm_res = client.post("/api/farms", json={
        "name": "Farmer Only Farm",
        "area_acres": 5.0,
        "latitude": 13.65,
        "longitude": 79.42,
    }, headers=f_headers)
    assert farm_res.status_code == 201
    farm_id = farm_res.json()["id"]

    job_res = client.post("/api/jobs", json={
        "farm_id": farm_id,
        "work_type": "Paddy Weeding",
        "required_skill": "weeding",
        "workers_required": 2,
        "start_date": str(date.today() + timedelta(days=1)),
        "duration_days": 2,
        "wage_per_day": 500.0,
    }, headers=f_headers)
    assert job_res.status_code == 201
    job_id = job_res.json()["id"]

    # Register Hybrid user
    hybrid_res = client.post("/api/auth/register", json={
        "name": "Hybrid User Two",
        "email": "hybrid2@example.com",
        "password": "Password123!",
        "role": "HYBRID",
        "phone": "+91 99000 33333",
    })
    assert hybrid_res.status_code == 201
    h_headers = {"Authorization": f"Bearer {hybrid_res.json()['token']}"}

    # Hybrid user CAN apply to Farmer's job
    apply_res = client.post(f"/api/jobs/{job_id}/apply", headers=h_headers)
    assert apply_res.status_code == 200
    assert apply_res.json()["status"] == "PENDING"


def test_worker_cannot_create_farm_or_post_job(client: TestClient):
    worker_res = client.post("/api/auth/register", json={
        "name": "Worker Only",
        "email": "worker.only@example.com",
        "password": "Password123!",
        "role": "WORKER",
        "phone": "+91 99000 44444",
    })
    assert worker_res.status_code == 201
    w_headers = {"Authorization": f"Bearer {worker_res.json()['token']}"}

    # Worker cannot create farm
    farm_res = client.post("/api/farms", json={
        "name": "Illegal Farm",
        "area_acres": 2.0,
        "latitude": 13.60,
        "longitude": 79.40,
    }, headers=w_headers)
    assert farm_res.status_code == 403


def test_farmer_cannot_apply_for_jobs(client: TestClient):
    # Create farm and job with Hybrid user
    h_res = client.post("/api/auth/register", json={
        "name": "Hybrid Three",
        "email": "hybrid3@example.com",
        "password": "Password123!",
        "role": "HYBRID",
        "phone": "+91 99000 55555",
    })
    h_token = h_res.json()["token"]
    h_headers = {"Authorization": f"Bearer {h_token}"}

    farm_res = client.post("/api/farms", json={
        "name": "Hybrid 3 Farm",
        "area_acres": 3.0,
        "latitude": 13.63,
        "longitude": 79.41,
    }, headers=h_headers)
    farm_id = farm_res.json()["id"]

    job_res = client.post("/api/jobs", json={
        "farm_id": farm_id,
        "work_type": "Groundnut Stripping",
        "required_skill": "harvesting",
        "workers_required": 1,
        "start_date": str(date.today() + timedelta(days=1)),
        "duration_days": 1,
        "wage_per_day": 520.0,
    }, headers=h_headers)
    job_id = job_res.json()["id"]

    # Register pure Farmer
    f_res = client.post("/api/auth/register", json={
        "name": "Farmer Pure",
        "email": "farmer.pure@example.com",
        "password": "Password123!",
        "role": "FARMER",
        "phone": "+91 99000 66666",
    })
    f_headers = {"Authorization": f"Bearer {f_res.json()['token']}"}

    # Farmer cannot apply to work
    apply_res = client.post(f"/api/jobs/{job_id}/apply", headers=f_headers)
    assert apply_res.status_code == 403


def test_user_can_dynamically_switch_role(client: TestClient):
    # Register as FARMER
    reg_res = client.post("/api/auth/register", json={
        "name": "Switch User",
        "email": "switch@example.com",
        "password": "Password123!",
        "role": "FARMER",
        "phone": "+91 99000 77777",
    })
    assert reg_res.status_code == 201
    assert reg_res.json()["role"] == "FARMER"
    token = reg_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Switch to HYBRID
    switch_res = client.put("/api/auth/me/role", json={"role": "HYBRID"}, headers=headers)
    assert switch_res.status_code == 200
    assert switch_res.json()["role"] == "HYBRID"
    new_token = switch_res.json()["token"]
    h_headers = {"Authorization": f"Bearer {new_token}"}

    # Verify worker profile is created and accessible
    profile_res = client.get("/api/workers/me", headers=h_headers)
    assert profile_res.status_code == 200

    # Switch to WORKER
    switch_res2 = client.put("/api/auth/me/role", json={"role": "WORKER"}, headers=h_headers)
    assert switch_res2.status_code == 200
    assert switch_res2.json()["role"] == "WORKER"
