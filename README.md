# AgriConnect (అగ్రికనెక్ట్ / एग्रीकनेक्ट)

> **Decentralized Agricultural Labour Marketplace, Farmer Profit Simulator & Farm AI Intelligence Hub**  
> *Built strictly in accordance with the AgriConnect Project Master Document, Software Requirements Specification (SRS), and Technical Design Blueprint.*

---

## 🌟 Overview & Key Capabilities

AgriConnect is a production-ready, modular monolith platform addressing agricultural labor friction, price discovery transparency, economic harvest planning, and field-level crop diagnostic access.

### 1. Transparent Labour Marketplace (`FR-JOB`, `FR-APP`, `FR-MAT`)
- **Farmer Farm & Job Management:** Register multiple farm parcels with GPS coordinates, post job openings (skill tags, daily wage, duration, required workers), and cancel unfilled or active jobs with automated applicant notifications (`FR-JOB-08`).
- **Worker Search & 1-Click Apply:** Worker profile management with availability toggles, skills, wage expectations, and Haversine radius search (5 km to 100 km).
- **Rule-Based Transparent Weighted Matching (`FR-MAT-01..05`):**
  $$\text{Score} = (0.35 \times \text{Skill Match}) + (0.30 \times \text{Proximity}) + (0.20 \times \text{Reputation}) + (0.15 \times \text{Experience})$$
  Provides unambiguous score breakdowns and human-readable explanation tags (`"Direct skill match"`, `"Within 10km"`, `"High reputation: 4.8★"`).
- **Hardened Booking Lifecycle & Anti-Double-Booking Guard (`FR-APP-07`):** Date overlap prevention blocks workers from being booked across overlapping calendar dates with an HTTP 409 conflict error.
- **Two-Way Verified Reviews:** 1-to-5 star ratings with written feedback submitted by both farmer and worker upon booking completion (`COMPLETED`), dynamically updating worker reputation scores.

### 2. Deterministic Farmer Profit Simulator (`FR-SIM-01..07`)
- **Deterministic Agricultural Economics Model:**
  - $\text{Expected Yield} = \text{Land Area} \times \text{Base Yield per Acre} \times \text{Scenario Multiplier}$
  - $\text{Gross Revenue} = \text{Expected Yield} \times \text{Market Price per Quintal}$
  - $\text{Total Operational Costs} = \text{Seeds} + \text{Fertilizers} + \text{Irrigation} + \text{Machinery} + \text{Labour} + \text{Pesticides} + \text{Transport} + \text{Misc}$
  - $\text{Net Profit} = \text{Gross Revenue} - \text{Total Operational Costs}$
  - $\text{Break-Even Price} = \frac{\text{Total Costs}}{\text{Expected Yield}}$
- **Sensitivity Matrix:** Multi-scenario projection for Low (-15%), Base (100%), and High (+15%) harvest yield outcomes.
- **Selling Channel Comparison Matrix:** Evaluates net margins across:
  1. *Local Village Mandi* (zero transport, lower gate price)
  2. *District APMC Yard* (higher MSP/benchmark price, transport & loading costs factored)
  3. *Cold Storage Deferred Sale* (peak market price, deduction for monthly refrigeration holding fees)
- **Historical Average Wage Autofill:** Live endpoint `GET /api/simulations/average-wage` pre-fills prevailing local agricultural wages by village/district.
- **Simulation Persistence:** Save, name, and recall scenario simulations across farming seasons.

### 3. Farm AI & Crop Intelligence Hub
- **Visual Crop Disease AI Diagnostic:** Photo upload diagnosis (Rice Leaf Blight, Wheat Rust, Cotton Bollworm, Chilli Leaf Curl, etc.) with confidence scores, disease descriptions, and actionable chemical and organic remedy dosages.
- **Soil & Climate Crop Recommendation Advisor:** Optimal crop advisory matching soil NPK (Nitrogen, Phosphorus, Potassium), pH levels, and rainfall/irrigation type with estimated ROI.
- **Grounded Agricultural RAG Assistant:** Semantic question-answering grounded with authentic citations from ICAR, ANGRAU, PM-KISAN, PMFBY, and state agricultural university bulletins.
- **Live APMC Mandi Price Intelligence:** Real-time commodity benchmark pricing catalogue across markets (Guntur, Warangal, Kurnool, Vijayawada, Khammam) with transport distance calculator.

### 4. Enterprise Hardening, Audit Trail & Governance (`FR-NOTIF`, `FR-AUDIT`)
- **Real-Time Notification System:** In-app notification drawer for job approvals, booking status changes, and cancellations with unread counters.
- **Comprehensive Audit Trail:** Immutable logging of critical lifecycle events (status updates, cancellations, suspensions, reviews).
- **Admin Governance Portal:** Platform KPI metrics (total farmers, workers, jobs, bookings, GMV), active/suspended user management, and audit log inspection.
- **Security & Authorization:** Token revocation and automatic request rejection for suspended accounts across all endpoints.

### 5. Supabase Cloud Hybrid Architecture
- **Managed PostgreSQL Database:** Cloud-hosted PostgreSQL with pooling (`aws-0-ap-south-1.pooler.supabase.com:6543`) for real-time transaction reliability and persistence.
- **Supabase Storage Bucket (`crop-scans`):** Cloud object storage for field photos and disease leaf diagnostics with public asset resolution.
- **Client Integration (`@supabase/supabase-js`):** Frontend client utility configured in `frontend/src/supabase.ts` for direct storage uploads and cloud sync.
- **Automated Migration (`supabase_schema.sql`):** Complete, idempotent SQL migration defining 12 tables, indexes, storage buckets, and initial seed data.

### 6. Multilingual Progressive Web App (PWA)
- **Trilingual Localization:** 1-click instantaneous interface translation across **English**, **Telugu (తెలుగు)**, and **Hindi (हिंदी)**.
- **1-Click Viva Demo Role Switcher:** Instant persona switching between Farmer, Worker, and Admin without re-typing passwords.
- **Rich Aesthetics:** Glassmorphism UI, high-contrast badges, mobile-responsive layout, and PWA manifest.

---

## 🏗️ Architecture & Technology Stack

| Component | Technology | Rationale |
|:---|:---|:---|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2 | High-performance asynchronous API, declarative ORM, strict Pydantic v2 schemas |
| **Database** | SQLite (Dev/Local) / PostgreSQL (Docker/Prod) | Zero-friction local development, seamless scale-up to PostgreSQL via SQLAlchemy |
| **Authentication** | JWT (PyJWT) + Passlib/Bcrypt | Stateless, role-enforced authentication with active-status checks |
| **Frontend** | React 19, TypeScript, Vite, Vanilla CSS | Fast, deterministic builds (<500ms), zero styling bloat, mobile-ready PWA |
| **Internationalization** | Typed i18n Context (en, te, hi) | Native bilingual agricultural support for Andhra Pradesh & Telangana regions |

---

## ⚡ Quickstart Guide

### Prerequisites
- Python 3.10+ (Python 3.12 recommended)
- Node.js 18+ & npm
- Git (optional)

---

### Step 1: Backend Setup & Launch

```powershell
# In project root:
# 1. Activate virtual environment
.\.venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the automated test suite (20 tests)
pytest -v

# 4. Start the FastAPI backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Interactive Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- OpenAPI JSON: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

### Step 2: Frontend Setup & Launch

```powershell
# Open a new terminal and navigate to frontend:
cd frontend

# Install node dependencies
npm.cmd install

# Start the Vite development server
npm.cmd run dev
```
- Frontend Web App: [http://localhost:5173/](http://localhost:5173/)

---

### Step 3: Run with Docker Compose (PostgreSQL)

```bash
docker compose up --build
```
- API accessible at `http://localhost:8000` with PostgreSQL 16 on port `5432`.

---

## 🎓 5-Minute Viva / Demo Walkthrough

The platform comes pre-seeded with realistic agricultural demo accounts:

| Role | Name | Email | Password | Pre-seeded Context |
|:---|:---|:---|:---|:---|
| **Farmer** | Ravi Kumar | `ravi@example.com` | `password123` | 1 Farm (Sri Venkateswara Farm, 3.5 acres), 1 Active Harvesting Job |
| **Worker** | Suresh Naidu | `suresh@example.com` | `password123` | Harvesting & Ploughing specialist, 5 yrs exp, Tirupati region |
| **Worker** | Lakshmi Devi | `lakshmi@example.com` | `password123` | Weeding & Transplanting specialist, 4 yrs exp |
| **Admin** | Administrator | `admin@agriconnect.com` | `admin12345` | System oversight, KPI metrics, Audit Logs, User Suspension |

### Suggested Viva Flow:
1. **1-Click Demo Bar (Top Banner):**
   - Click **"🌾 Ravi (Farmer)"** -> Notice instantaneous login, pre-populated farms, and posted jobs.
   - Click **"View Applicants & Ranked Matches"** -> Observe the transparent weighted matching score breakdown (Skills + Proximity + Reputation + Experience).
2. **Double-Booking & Hardening Test:**
   - Accept Suresh for a job. If Suresh is already committed on overlapping dates, verify the system rejects with a double-booking guard alert (`FR-APP-07`).
3. **Farmer Profit Simulator (`FR-SIM`):**
   - Navigate to the **"Profit Simulator"** tab.
   - Enter: Crop = Chilli, Land Area = 5 acres, Yield = 18 quintals/acre, Sale Price = ₹18,500/quintal.
   - Click **"Autofill Avg Wage"** -> Fetches the average prevailing daily wage (`₹550/day`).
   - Click **"Calculate Profit & Sensitivity"** -> Review the Gross Revenue, Net Profit, Profit Margin, Break-even price, and the 3-channel APMC vs Mandi comparison table.
4. **Farm AI & Crop Intelligence Hub:**
   - Navigate to **"Farm AI Hub"**.
   - **Disease Scanner:** Select sample image (`Chilli Leaf Curl` or `Rice Blast`) -> View confidence %, symptoms, and chemical/organic treatments (e.g. *Trichoderma viride*).
   - **Crop Advisor:** Enter soil values ($N=120, P=60, K=50, \text{pH}=6.8$) -> Receive tailored high-ROI crop recommendations.
   - **RAG Assistant:** Ask: *"What is the PM-KISAN installment schedule and subsidy for micro-irrigation?"* -> Receive an exact answer with cited official bulletins.
   - **Mandi Prices:** Compare live Guntur vs Warangal prices with distance freight deductions.
5. **Language Switcher:**
   - Switch language at top right to **తెలుగు (Telugu)** or **हिंदी (Hindi)** to demonstrate rural multilingual accessibility.
6. **Admin Governance & Audit:**
   - Click **"⚙️ Platform Admin"** -> View system metrics, live audit logs, and toggle account suspension.

---

## 🧪 Automated Test Suite (20 Tests, 100% Passing)

Run the automated pytest suite:
```powershell
.\.venv\Scripts\pytest.exe -v
```

### Verified Test Matrix:
1. `tests/test_flow.py` (5 tests): Full marketplace flow, unauthorized job access guards, auth validation, job filling mechanics, past date rejection.
2. `tests/test_matching.py` (4 tests): Perfect score evaluation, proximity weighting, max-distance falloffs, unrated neutral reputation defaults.
3. `tests/test_hardening.py` (2 tests): Job cancellation with state cascade (`FR-JOB-08`), date-overlap double-booking prevention (`FR-APP-07`).
4. `tests/test_simulator.py` (3 tests): Profit and break-even formulas, zero-cost edge cases, simulation saving and retrieval.
5. `tests/test_intelligence.py` (4 tests): Soil-based crop recommendations, disease scanning and scan history, grounded agricultural RAG Q&A, APMC mandi price comparison.
6. `tests/test_admin_notifications.py` (2 tests): In-app notification creation/reading/counting, admin metrics and user suspension toggle.

---

## ⚖️ Ethical & Advisory Disclaimers

- **Economic Simulator (`FR-SIM-07`):** Projections are deterministic estimates based on provided inputs and regional averages. Actual agricultural returns depend on climate variations, pest infestations, spot market price fluctuations, and post-harvest handling.
- **Crop Disease AI:** Visual diagnostic assessments and treatment recommendations are decision-support aids. Farmers are advised to consult their local Krishi Vigyan Kendra (KVK) or agricultural extension officer before large-scale pesticide applications.
