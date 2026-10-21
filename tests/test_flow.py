from datetime import date, timedelta


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def register(client, name, email, role):
    r = client.post("/api/auth/register",
                    json={"name": name, "email": email, "password": "password123", "role": role})
    assert r.status_code == 201, r.text
    return r.json()


def setup_job(client):
    farmer = register(client, "Ravi", "ravi@example.com", "FARMER")
    w1 = register(client, "Near Worker", "near@example.com", "WORKER")
    w2 = register(client, "Far Worker", "far@example.com", "WORKER")
    assert client.put("/api/workers/me", headers=auth(w1["token"]), json={
        "skills": ["harvesting"], "experience_years": 6, "latitude": 13.65, "longitude": 79.42,
        "available": True}).status_code == 200
    assert client.put("/api/workers/me", headers=auth(w2["token"]), json={
        "skills": ["weeding"], "experience_years": 1, "latitude": 15.5, "longitude": 80.0,
        "available": True}).status_code == 200
    farm = client.post("/api/farms", headers=auth(farmer["token"]), json={
        "name": "Ravi Farm", "area_acres": 3.5, "latitude": 13.63, "longitude": 79.40,
        "soil_info": "red soil"})
    assert farm.status_code == 201, farm.text
    job_body = {"farm_id": farm.json()["id"], "work_type": "Groundnut harvesting",
                "required_skill": "harvesting", "workers_required": 1,
                "start_date": str(date.today() + timedelta(days=3)), "duration_days": 2,
                "wage_per_day": 500}
    job = client.post("/api/jobs", headers=auth(farmer["token"]), json=job_body)
    assert job.status_code == 201, job.text
    return farmer, w1, w2, job_body, job.json()


def test_full_marketplace_flow(client):
    farmer, w1, w2, job_body, job = setup_job(client)
    job_id = job["id"]

    # security rules
    assert client.post("/api/jobs", headers=auth(w1["token"]), json=job_body).status_code == 403
    assert client.get("/api/jobs").status_code == 401
    assert client.get("/api/jobs", headers=auth("garbage")).status_code == 401

    # discovery + matching
    r = client.get("/api/jobs/nearby", headers=auth(w1["token"]),
                   params={"lat": 13.65, "lon": 79.42, "radius_km": 20})
    assert r.status_code == 200 and len(r.json()) == 1
    matches = client.get(f"/api/jobs/{job_id}/matches", headers=auth(farmer["token"])).json()
    assert matches[0]["worker_id"] == w1["user_id"]
    assert matches[0]["score"] > matches[1]["score"]

    # apply (duplicate is rejected)
    a1 = client.post(f"/api/jobs/{job_id}/apply", headers=auth(w1["token"]))
    assert a1.status_code == 200
    assert client.post(f"/api/jobs/{job_id}/apply", headers=auth(w2["token"])).status_code == 200
    assert client.post(f"/api/jobs/{job_id}/apply", headers=auth(w1["token"])).status_code == 409
    apps = client.get(f"/api/jobs/{job_id}/applications", headers=auth(farmer["token"])).json()
    assert len(apps) == 2

    # accept -> booking, job filled, other application rejected
    b = client.post(f"/api/applications/{a1.json()['id']}/accept", headers=auth(farmer["token"]))
    assert b.status_code == 200
    assert client.get(f"/api/jobs/{job_id}", headers=auth(farmer["token"])).json()["status"] == "FILLED"
    apps = client.get(f"/api/jobs/{job_id}/applications", headers=auth(farmer["token"])).json()
    assert sorted(a["status"] for a in apps) == ["ACCEPTED", "REJECTED"]

    # cannot review before completion
    booking_id = b.json()["id"]
    early = client.post("/api/reviews", headers=auth(farmer["token"]),
                        json={"booking_id": booking_id, "rating": 5})
    assert early.status_code == 409

    # complete
    assert client.post(f"/api/bookings/{booking_id}/complete",
                       headers=auth(farmer["token"])).status_code == 200
    assert client.get(f"/api/jobs/{job_id}", headers=auth(farmer["token"])).json()["status"] == "COMPLETED"

    # reviews both ways; a stranger cannot review
    assert client.post("/api/reviews", headers=auth(farmer["token"]), json={
        "booking_id": booking_id, "rating": 5, "comment": "Hard worker"}).status_code == 201
    assert client.post("/api/reviews", headers=auth(w1["token"]), json={
        "booking_id": booking_id, "rating": 4, "comment": "Paid on time"}).status_code == 201
    assert client.post("/api/reviews", headers=auth(w2["token"]), json={
        "booking_id": booking_id, "rating": 1}).status_code == 403
    prof = client.get(f"/api/workers/{w1['user_id']}", headers=auth(farmer["token"])).json()
    assert prof["avg_rating"] == 5.0 and prof["review_count"] == 1

    # my bookings for both roles
    assert len(client.get("/api/bookings/mine", headers=auth(farmer["token"])).json()) == 1
    assert len(client.get("/api/bookings/mine", headers=auth(w1["token"])).json()) == 1
    assert client.get("/api/bookings/mine", headers=auth(w2["token"])).json() == []


def test_farmer_cannot_touch_another_farmers_job(client):
    farmer, w1, _, _, job = setup_job(client)
    other = register(client, "Other", "other@example.com", "FARMER")
    h = auth(other["token"])
    assert client.get(f"/api/jobs/{job['id']}/applications", headers=h).status_code == 403
    assert client.get(f"/api/jobs/{job['id']}/matches", headers=h).status_code == 403
    app = client.post(f"/api/jobs/{job['id']}/apply", headers=auth(w1["token"])).json()
    assert client.post(f"/api/applications/{app['id']}/accept", headers=h).status_code == 403


def test_auth_validation_and_login(client):
    register(client, "Ravi", "ravi@example.com", "FARMER")
    dup = client.post("/api/auth/register", json={
        "name": "Ravi", "email": "RAVI@example.com", "password": "password123", "role": "FARMER"})
    assert dup.status_code == 409
    assert client.post("/api/auth/register", json={
        "name": "X", "email": "x@example.com", "password": "short", "role": "FARMER"}).status_code == 422
    assert client.post("/api/auth/register", json={
        "name": "X", "email": "x@example.com", "password": "password123", "role": "ADMIN"}).status_code == 422
    ok = client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "password123"})
    assert ok.status_code == 200 and ok.json()["role"] == "FARMER"
    bad = client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "wrongpass1"})
    assert bad.status_code == 401


def test_job_fills_only_when_enough_workers_accepted(client):
    farmer, w1, w2, job_body, _ = setup_job(client)
    job_body = {**job_body, "workers_required": 2}
    job = client.post("/api/jobs", headers=auth(farmer["token"]), json=job_body).json()
    a1 = client.post(f"/api/jobs/{job['id']}/apply", headers=auth(w1["token"])).json()
    a2 = client.post(f"/api/jobs/{job['id']}/apply", headers=auth(w2["token"])).json()
    client.post(f"/api/applications/{a1['id']}/accept", headers=auth(farmer["token"]))
    assert client.get(f"/api/jobs/{job['id']}", headers=auth(farmer["token"])).json()["status"] == "OPEN"
    client.post(f"/api/applications/{a2['id']}/accept", headers=auth(farmer["token"]))
    assert client.get(f"/api/jobs/{job['id']}", headers=auth(farmer["token"])).json()["status"] == "FILLED"


def test_past_start_date_is_rejected(client):
    farmer, _, _, job_body, _ = setup_job(client)
    bad = {**job_body, "start_date": str(date.today() - timedelta(days=1))}
    assert client.post("/api/jobs", headers=auth(farmer["token"]), json=bad).status_code == 422
