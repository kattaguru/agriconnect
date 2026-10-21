from app.models import Role, User
from app.security import create_token, hash_password


def test_notifications_flow(client):
    r = client.post("/api/auth/register", json={
        "name": "Notif User", "email": "notif@example.com", "password": "password123", "role": "WORKER"
    })
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Initial notifications check
    res = client.get("/api/notifications", headers=headers)
    assert res.status_code == 200

    unread = client.get("/api/notifications/unread-count", headers=headers).json()
    assert "unread_count" in unread

    # Mark all read
    mark_all = client.post("/api/notifications/read-all", headers=headers)
    assert mark_all.status_code == 200


def test_admin_metrics_and_suspension(client):
    # Register an admin user directly into db via test client or helper
    # In conftest fresh DB, let's register a normal user first
    r_f = client.post("/api/auth/register", json={
        "name": "Target User", "email": "target@example.com", "password": "password123", "role": "FARMER"
    })
    target_token = r_f.json()["token"]
    target_id = r_f.json()["user_id"]
    target_headers = {"Authorization": f"Bearer {target_token}"}

    # Let's create an admin token manually using app's security
    admin_user = User(
        id=999, name="Admin Test", email="admin.test@example.com",
        password_hash=hash_password("admin12345"), role=Role.ADMIN.value, is_active=True
    )
    # We can seed admin through /api/demo/users or generate token
    demo_res = client.get("/api/demo/users").json()
    admin_token = demo_res["admin"]["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Test metrics endpoint
    metrics = client.get("/api/admin/metrics", headers=admin_headers)
    assert metrics.status_code == 200
    m_data = metrics.json()
    assert m_data["total_users"] >= 2
    assert m_data["total_farmers"] >= 1

    # Test users list
    users = client.get("/api/admin/users", headers=admin_headers)
    assert users.status_code == 200
    assert any(u["email"] == "target@example.com" for u in users.json())

    # Suspend target user
    sus_res = client.post(f"/api/admin/users/{target_id}/suspend", headers=admin_headers)
    assert sus_res.status_code == 200
    assert sus_res.json()["is_active"] is False

    # Suspended user cannot access authenticated endpoints
    blocked = client.get("/api/farms/mine", headers=target_headers)
    assert blocked.status_code == 403

    # Audit logs recorded suspension
    audit = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert audit.status_code == 200
    assert any(log["action"] == "SUSPEND_USER" for log in audit.json())


def test_job_posting_notifies_workers_within_range(client):
    from datetime import date, timedelta

    # 1. Register Farmer
    r_f = client.post("/api/auth/register", json={
        "name": "Kiran Farmer", "email": "kiran@example.com", "password": "password123", "role": "FARMER"
    }).json()
    f_headers = {"Authorization": f"Bearer {r_f['token']}"}

    # 2. Register Near Worker (within 5 km)
    r_wnear = client.post("/api/auth/register", json={
        "name": "Near Worker", "email": "wnear@example.com", "password": "password123", "role": "WORKER"
    }).json()
    near_headers = {"Authorization": f"Bearer {r_wnear['token']}"}
    client.put("/api/workers/me", headers=near_headers, json={
        "skills": ["harvesting"], "experience_years": 3, "latitude": 13.65, "longitude": 79.42, "available": True
    })

    # 3. Register Far Worker (> 150 km)
    r_wfar = client.post("/api/auth/register", json={
        "name": "Far Worker", "email": "wfar@example.com", "password": "password123", "role": "WORKER"
    }).json()
    far_headers = {"Authorization": f"Bearer {r_wfar['token']}"}
    client.put("/api/workers/me", headers=far_headers, json={
        "skills": ["harvesting"], "experience_years": 5, "latitude": 15.50, "longitude": 80.00, "available": True
    })

    # 4. Farmer registers farm
    farm = client.post("/api/farms", headers=f_headers, json={
        "name": "Kiran Farm", "area_acres": 4.0, "latitude": 13.63, "longitude": 79.40, "soil_info": "black soil"
    }).json()

    # 5. Farmer posts job with notify_radius_km = 25 km
    job_res = client.post("/api/jobs", headers=f_headers, json={
        "farm_id": farm["id"],
        "work_type": "Chilli Harvesting",
        "required_skill": "harvesting",
        "workers_required": 2,
        "start_date": str(date.today() + timedelta(days=2)),
        "duration_days": 3,
        "wage_per_day": 600,
        "notify_radius_km": 25.0,
    })
    assert job_res.status_code == 201
    job_data = job_res.json()
    assert job_data["notified_workers_count"] == 1

    # 6. Verify Near Worker received notification
    near_notifs = client.get("/api/notifications", headers=near_headers).json()
    assert len(near_notifs) >= 1
    job_alert = next((n for n in near_notifs if n["type"] == "JOB_ALERT"), None)
    assert job_alert is not None
    assert "Chilli Harvesting" in job_alert["title"]
    assert "Kiran Farm" in job_alert["message"]
    assert job_alert["is_read"] is False

    # 7. Verify Far Worker received NO job alert
    far_notifs = client.get("/api/notifications", headers=far_headers).json()
    assert not any(n["type"] == "JOB_ALERT" for n in far_notifs)
