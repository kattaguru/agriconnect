import pytest


def test_phone_send_otp_success(client):
    # Send OTP to a standard 10-digit phone
    res = client.post("/api/auth/phone/send-otp", json={"phone": "9876543210"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["phone"] == "9876543210"
    assert "demo_otp" in data
    assert len(data["demo_otp"]) == 6


def test_phone_send_otp_invalid_phone(client):
    # Too short
    res = client.post("/api/auth/phone/send-otp", json={"phone": "123"})
    assert res.status_code == 422 or res.status_code == 400


def test_phone_verify_otp_new_user_registration(client):
    # Send OTP
    send_res = client.post("/api/auth/phone/send-otp", json={"phone": "+91 91234 56789"})
    assert send_res.status_code == 200
    demo_otp = send_res.json()["demo_otp"]

    # Verify OTP with new user details
    verify_res = client.post(
        "/api/auth/phone/verify-otp",
        json={
            "phone": "9123456789",
            "otp": demo_otp,
            "name": "Kishan Lal",
            "role": "FARMER",
        },
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["name"] == "Kishan Lal"
    assert data["role"] == "FARMER"
    assert "token" in data
    assert "+91 91234 56789" in data["phone"] or "9123456789" in data["phone"]


def test_phone_verify_otp_with_master_code(client):
    # Send OTP
    client.post("/api/auth/phone/send-otp", json={"phone": "9988776655"})

    # Verify using universal test code 123456
    verify_res = client.post(
        "/api/auth/phone/verify-otp",
        json={
            "phone": "9988776655",
            "otp": "123456",
            "name": "Gopal Worker",
            "role": "WORKER",
        },
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["name"] == "Gopal Worker"
    assert data["role"] == "WORKER"
    assert "token" in data


def test_phone_verify_otp_existing_user(client):
    # Register user via email and phone first
    client.post(
        "/api/auth/register",
        json={
            "name": "Sita Devi",
            "email": "sita@example.com",
            "phone": "+91 94411 22334",
            "password": "password123",
            "role": "FARMER",
        },
    )

    # Now verify login with OTP using phone
    send_res = client.post("/api/auth/phone/send-otp", json={"phone": "9441122334"})
    assert send_res.status_code == 200
    assert send_res.json()["is_existing_user"] is True

    # Verify OTP
    verify_res = client.post(
        "/api/auth/phone/verify-otp",
        json={"phone": "9441122334", "otp": "123456"},
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["name"] == "Sita Devi"
    assert data["email"] == "sita@example.com"


def test_phone_verify_otp_invalid_code(client):
    client.post("/api/auth/phone/send-otp", json={"phone": "9876543210"})
    res = client.post(
        "/api/auth/phone/verify-otp",
        json={"phone": "9876543210", "otp": "999999"},
    )
    assert res.status_code == 400
    assert "Invalid or expired OTP" in res.json()["detail"]
