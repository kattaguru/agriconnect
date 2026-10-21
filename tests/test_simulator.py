def test_simulator_formulas(client):
    # Register farmer and login
    r = client.post("/api/auth/register", json={
        "name": "Sim Farmer", "email": "sim@example.com", "password": "password123", "role": "FARMER"
    })
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Base calculation test: Groundnut 3.5 acres, 35 qtl yield, ₹7000/qtl
    sim_data = {
        "crop_name": "Groundnut",
        "area_acres": 3.5,
        "expected_yield_qtl": 35.0,
        "selling_price_per_qtl": 7000.0,
        "seed_cost": 14000.0,
        "fertilizer_cost": 8500.0,
        "pesticide_cost": 4500.0,
        "irrigation_cost": 3000.0,
        "labour_cost": 22000.0,
        "machinery_cost": 7500.0,
        "transport_cost": 2500.0,
        "other_cost": 1500.0,
    }
    res = client.post("/api/simulations/calculate", json=sim_data, headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Total cost = 14000+8500+4500+3000+22000+7500+2500+1500 = 63500
    assert data["total_cost"] == 63500.0
    # Gross revenue = 35 * 7000 = 245000
    assert data["gross_revenue"] == 245000.0
    # Net profit = 245000 - 63500 = 181500
    assert data["net_profit"] == 181500.0
    # Profit per acre = 181500 / 3.5 = 51857.14
    assert abs(data["profit_per_acre"] - 51857.14) < 1.0
    # Break-even price = 63500 / 35 = 1814.29
    assert abs(data["break_even_price"] - 1814.29) < 0.1
    # Break-even yield = 63500 / 7000 = 9.07
    assert abs(data["break_even_yield"] - 9.07) < 0.1

    # Check scenarios (3 scenarios: Low, Base, High)
    assert len(data["scenarios"]) == 3
    low = data["scenarios"][0]
    high = data["scenarios"][2]
    assert low["yield_qtl"] == 35.0 * 0.8
    assert high["yield_qtl"] == 35.0 * 1.2
    assert low["net_profit"] < data["net_profit"] < high["net_profit"]

    # Check selling options (ranked and best flagged)
    assert len(data["selling_options"]) >= 2
    best_opt = [o for o in data["selling_options"] if o["is_best"]]
    assert len(best_opt) == 1
    assert "disclaimer" in data


def test_simulator_zero_edge_cases(client):
    r = client.post("/api/auth/register", json={
        "name": "Zero Farmer", "email": "zero@example.com", "password": "password123", "role": "FARMER"
    })
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Zero yield and price should not crash (no DivisionByZero error)
    sim_data = {
        "crop_name": "Test",
        "area_acres": 1.0,
        "expected_yield_qtl": 0.0,
        "selling_price_per_qtl": 0.0,
        "seed_cost": 5000.0,
    }
    res = client.post("/api/simulations/calculate", json=sim_data, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["break_even_price"] == 0.0
    assert data["break_even_yield"] == 0.0
    assert data["net_profit"] == -5000.0


def test_save_and_retrieve_simulation(client):
    r = client.post("/api/auth/register", json={
        "name": "Save Farmer", "email": "save@example.com", "password": "password123", "role": "FARMER"
    })
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Save
    save_body = {
        "crop_name": "Groundnut",
        "area_acres": 2.5,
        "inputs": {"yield": 25, "price": 6800},
        "results": {"net_profit": 110000},
    }
    res = client.post("/api/simulations/save", json=save_body, headers=headers)
    assert res.status_code == 201
    sim_id = res.json()["id"]

    # Retrieve
    res_list = client.get("/api/simulations/mine", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1
    assert res_list.json()[0]["crop_name"] == "Groundnut"

    # Delete
    del_res = client.delete(f"/api/simulations/{sim_id}", headers=headers)
    assert del_res.status_code == 204
    assert len(client.get("/api/simulations/mine", headers=headers).json()) == 0
