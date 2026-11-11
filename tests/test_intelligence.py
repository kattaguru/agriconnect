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


def test_disease_scanner_with_image_and_differential(client):
    import base64
    import io
    from PIL import Image

    r = client.post("/api/auth/register", json={
        "name": "Vision Farmer", "email": "vision@example.com", "password": "password123", "role": "FARMER"
    })
    headers = {"Authorization": f"Bearer {r.json()['token']}"}

    # Generate small synthetic test image (e.g. 64x64 with yellowish/brown lesion on green leaf)
    img = Image.new("RGB", (64, 64), color=(34, 139, 34))  # Forest green
    # Add yellowish chlorotic spot
    for x in range(20, 45):
        for y in range(20, 45):
            img.putpixel((x, y), (218, 165, 32))  # Goldenrod yellow chlorosis
    # Add dark necrotic center
    for x in range(28, 36):
        for y in range(28, 36):
            img.putpixel((x, y), (80, 40, 20))  # Dark brown necrotic spot

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")

    res = client.post("/api/intelligence/disease-scan", json={
        "crop_name": "Groundnut",
        "image_base64": f"data:image/png;base64,{b64_str}",
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "disease_name" in data
    assert data["confidence"] > 0.70
    assert "differential_diagnoses" in data
    assert len(data["differential_diagnoses"]) >= 2
    assert "visual_metrics" in data
    assert data["visual_metrics"]["chlorosis_percent"] > 0
    assert len(data["organic_remedies"]) > 0
    assert len(data["chemical_treatments"]) > 0


def test_model_training_and_info(client):
    r = client.post("/api/auth/register", json={
        "name": "Admin Model", "email": "adminmodel@example.com", "password": "password123", "role": "FARMER"
    })
    headers = {"Authorization": f"Bearer {r.json()['token']}"}

    # Get model info
    info_res = client.get("/api/intelligence/model-info")
    assert info_res.status_code == 200
    info = info_res.json()
    assert "AgriConnect" in info["model_name"]
    assert len(info["classes"]) >= 7
    assert info["accuracy_percent"] >= 95.0

    # Trigger re-train
    train_res = client.post("/api/intelligence/train-model", headers=headers)
    assert train_res.status_code == 200
    train_data = train_res.json()
    assert train_data["status"] == "success"
    assert train_data["training_samples"] >= 1400
    assert train_data["classes_trained"] >= 7
    assert train_data["accuracy_percent"] >= 95.0

