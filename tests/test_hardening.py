from datetime import date, timedelta


def test_job_cancellation(client):
    # Farmer registers
    r_f = client.post("/api/auth/register", json={
        "name": "Cancel Farmer", "email": "cf@example.com", "password": "password123", "role": "FARMER"
    })
    f_token = r_f.json()["token"]
    f_headers = {"Authorization": f"Bearer {f_token}"}

    # Worker registers
    r_w = client.post("/api/auth/register", json={
        "name": "Cancel Worker", "email": "cw@example.com", "password": "password123", "role": "WORKER"
    })
    w_token = r_w.json()["token"]
    w_headers = {"Authorization": f"Bearer {w_token}"}

    # Farm
    farm = client.post("/api/farms", json={
        "name": "F1", "area_acres": 2.0, "latitude": 13.6, "longitude": 79.4
    }, headers=f_headers).json()

    # Job
    job = client.post("/api/jobs", json={
        "farm_id": farm["id"], "work_type": "Weeding", "workers_required": 1,
        "start_date": str(date.today() + timedelta(days=2)), "duration_days": 2, "wage_per_day": 500
    }, headers=f_headers).json()

    # Worker applies
    client.post(f"/api/jobs/{job['id']}/apply", headers=w_headers)

    # Farmer cancels job
    cancel_res = client.patch(f"/api/jobs/{job['id']}/cancel", headers=f_headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Cannot apply to cancelled job
    app_res = client.post(f"/api/jobs/{job['id']}/apply", headers=w_headers)
    assert app_res.status_code == 409

    # Worker received notification about cancellation
    notifs = client.get("/api/notifications", headers=w_headers).json()
    assert any(n["type"] == "JOB_CANCELLED" for n in notifs)


def test_double_booking_prevention(client):
    r_f = client.post("/api/auth/register", json={
        "name": "Overlap Farmer", "email": "of@example.com", "password": "password123", "role": "FARMER"
    })
    f_headers = {"Authorization": f"Bearer {r_f.json()['token']}"}

    r_w = client.post("/api/auth/register", json={
        "name": "Overlap Worker", "email": "ow@example.com", "password": "password123", "role": "WORKER"
    })
    w_headers = {"Authorization": f"Bearer {r_w.json()['token']}"}

    farm = client.post("/api/farms", json={
        "name": "F2", "area_acres": 3.0, "latitude": 13.6, "longitude": 79.4
    }, headers=f_headers).json()

    # Job 1: Days 2 to 6 (duration 4 days)
    job1 = client.post("/api/jobs", json={
        "farm_id": farm["id"], "work_type": "Harvesting", "workers_required": 1,
        "start_date": str(date.today() + timedelta(days=2)), "duration_days": 4, "wage_per_day": 500
    }, headers=f_headers).json()

    # Job 2: Overlapping: Days 4 to 7 (duration 3 days)
    job2 = client.post("/api/jobs", json={
        "farm_id": farm["id"], "work_type": "Threshing", "workers_required": 1,
        "start_date": str(date.today() + timedelta(days=4)), "duration_days": 3, "wage_per_day": 550
    }, headers=f_headers).json()

    # Worker applies to both
    a1 = client.post(f"/api/jobs/{job1['id']}/apply", headers=w_headers).json()
    a2 = client.post(f"/api/jobs/{job2['id']}/apply", headers=w_headers).json()

    # Farmer accepts worker for Job 1 -> succeeds
    res1 = client.post(f"/api/applications/{a1['id']}/accept", headers=f_headers)
    assert res1.status_code == 200

    # Farmer tries to accept worker for Job 2 -> MUST fail with 409 due to overlapping dates!
    res2 = client.post(f"/api/applications/{a2['id']}/accept", headers=f_headers)
    assert res2.status_code == 409
    assert "overlapping" in res2.json()["detail"].lower()
