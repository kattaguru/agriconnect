def test_crop_recommendation(client):
    r = client.post("/api/auth/register", json={
        "name": "Intel Farmer", "email": "intel@example.com", "password": "password123", "role": "FARMER"
    })
    headers = {"Authorization": f"Bearer {r.json()['token']}"}

    # Query recommendation for Kharif, Red Loamy, Borewell
    req = {
        "district": "Tirupati",
        "area_acres": 3.0,
        "soil_type": "Red Loamy",
        "soil_ph": 6.5,
        "water_source": "Borewell",
        "season": "Kharif",
    }
    res = client.post("/api/intelligence/crop-recommendation", json=req, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["recommended_crops"]) >= 4
    # Groundnut should be near or at top for Red Loamy / Kharif / Tirupati
    top_crop = data["recommended_crops"][0]
    assert top_crop["compatibility_score"] >= 80
    assert "disclaimer" in data


def test_disease_scanner_and_history(client):
    r = client.post("/api/auth/register", json={
        "name": "Disease Farmer", "email": "disease@example.com", "password": "password123", "role": "FARMER"
    })
    headers = {"Authorization": f"Bearer {r.json()['token']}"}

    # Scan groundnut tikka
    res = client.post("/api/intelligence/disease-scan", json={
        "crop_name": "Groundnut", "sample_id": "groundnut_tikka"
    }, headers=headers)
    assert res.status_code == 200
    diag = res.json()
    assert "Leaf Spot" in diag["disease_name"] or "Tikka" in diag["disease_name"]
    assert diag["confidence"] > 0.8
    assert len(diag["organic_remedies"]) > 0
    assert len(diag["chemical_treatments"]) > 0
    assert "disclaimer" in diag

    # Check history is saved
    hist = client.get("/api/intelligence/scan-history", headers=headers).json()
    assert len(hist) >= 1
    assert hist[0]["disease_name"] == diag["disease_name"]


def test_rag_grounded_qa(client):
    r = client.post("/api/auth/register", json={
        "name": "RAG User", "email": "rag@example.com", "password": "password123", "role": "FARMER"
    })
    headers = {"Authorization": f"Bearer {r.json()['token']}"}

    # Question about Groundnut Gypsum
    res = client.post("/api/intelligence/rag-query", json={
        "question": "When and why should gypsum be applied to groundnut?"
    }, headers=headers)
    assert res.status_code == 200
    ans = res.json()
    assert ans["grounded"] is True
    assert len(ans["sources"]) >= 1
    assert "ANGRAU" in ans["sources"][0]["source"] or "ICAR" in ans["sources"][0]["source"]

    # Out of scope / unsupported question
    res_unknown = client.post("/api/intelligence/rag-query", json={
        "question": "How to trade Bitcoin cryptocurrency on Wall Street?"
    }, headers=headers)
    assert res_unknown.status_code == 200
    ans_unk = res_unknown.json()
    assert ans_unk["grounded"] is False
    assert ans_unk["confidence"] == 0.0


def test_market_prices_and_comparison(client):
    r = client.post("/api/auth/register", json={
        "name": "Mkt User", "email": "mkt@example.com", "password": "password123", "role": "FARMER"
    })
    headers = {"Authorization": f"Bearer {r.json()['token']}"}

    # List market prices
    prices = client.get("/api/intelligence/market-prices?crop=Groundnut", headers=headers).json()
    assert len(prices) >= 2
    assert all("Groundnut" in p["crop"] for p in prices)

    # Market comparison
    comp_res = client.post("/api/intelligence/market-compare", json={
        "crop": "Groundnut", "quantity_qtl": 40.0, "current_lat": 13.63, "current_lon": 79.40
    }, headers=headers)
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert len(comp["options"]) >= 2
    assert any(opt["is_best"] for opt in comp["options"])
