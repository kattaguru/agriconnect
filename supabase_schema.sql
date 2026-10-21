-- =========================================================================
-- AgriConnect (అగ్రికనెక్ట్ / एग्रीकनेक्ट) - Supabase Cloud PostgreSQL Schema
-- Run this script in the Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New query -> Paste & Run
-- =========================================================================

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS farms (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    area_acres DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    soil_info VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_farms_owner ON farms(owner_id);

CREATE TABLE IF NOT EXISTS worker_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    skills JSONB DEFAULT '[]'::jsonb,
    experience_years INTEGER DEFAULT 0,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    available BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_user ON worker_profiles(user_id);

CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    work_type VARCHAR(120) NOT NULL,
    required_skill VARCHAR(80),
    workers_required INTEGER NOT NULL,
    start_date DATE NOT NULL,
    duration_days INTEGER NOT NULL,
    wage_per_day DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_farm ON jobs(farm_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS job_applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING',
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_job_worker UNIQUE(job_id, worker_id)
);
CREATE INDEX IF NOT EXISTS idx_job_app_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_app_worker ON job_applications(worker_id);

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bookings_job ON bookings(job_id);
CREATE INDEX IF NOT EXISTS idx_bookings_worker ON bookings(worker_id);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    reviewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reviewed_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_booking_reviewer UNIQUE(booking_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON reviews(reviewed_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    resource VARCHAR(80) NOT NULL,
    details VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message VARCHAR(500) NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO',
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS profit_simulations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
    crop_name VARCHAR(100) NOT NULL,
    area_acres DOUBLE PRECISION NOT NULL,
    inputs JSONB NOT NULL,
    results JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profit_simulations_user ON profit_simulations(user_id);

CREATE TABLE IF NOT EXISTS market_prices (
    id SERIAL PRIMARY KEY,
    crop VARCHAR(100) NOT NULL,
    market VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    arrival_date DATE NOT NULL,
    min_price DOUBLE PRECISION NOT NULL,
    max_price DOUBLE PRECISION NOT NULL,
    modal_price DOUBLE PRECISION NOT NULL,
    source VARCHAR(100) DEFAULT 'Agmarknet APMC',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_market_prices_crop ON market_prices(crop);
CREATE INDEX IF NOT EXISTS idx_market_prices_market ON market_prices(market);

CREATE TABLE IF NOT EXISTS crop_scans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    crop_name VARCHAR(100) NOT NULL,
    disease_name VARCHAR(120) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    severity VARCHAR(50) NOT NULL,
    symptoms VARCHAR(500),
    recommendations VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crop_scans_user ON crop_scans(user_id);

-- 2. Create Storage Bucket for Crop Disease Uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('crop-scans', 'crop-scans', true)
ON CONFLICT (id) DO NOTHING;

-- Storage public read policy
CREATE POLICY "Public Read Crop Scans"
ON storage.objects FOR SELECT
USING (bucket_id = 'crop-scans');

-- Storage insert policy (allow authenticated or anon uploads)
CREATE POLICY "Public Upload Crop Scans"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'crop-scans');

-- 3. Seed Demo Users & Market Prices
-- Supported Roles:
--   - 'FARMER': Farmer only (owns farms, posts jobs, hires workers, runs simulations)
--   - 'WORKER': Worker only (sets worker profile, searches nearby jobs, applies for work)
--   - 'HYBRID': Both Farmer & Worker (owns farms & posts jobs AND can apply for work elsewhere)
--   - 'ADMIN' : Platform Administrator
INSERT INTO users (id, name, email, phone, password_hash, role, is_active)
VALUES 
(1, 'Platform Administrator', 'admin@agriconnect.com', '+91 98765 00000', '$2b$12$Nq54c1vXn01W6iO3gVsmx.L6tPZfRk3i1R4qW4k1g8b0wB3A8l6eO', 'ADMIN', true),
(2, 'Ravi Kumar (Farmer)', 'ravi@example.com', '+91 94401 23456', '$2b$12$Nq54c1vXn01W6iO3gVsmx.L6tPZfRk3i1R4qW4k1g8b0wB3A8l6eO', 'FARMER', true),
(3, 'Suresh Naidu (Worker)', 'suresh@example.com', '+91 98852 34567', '$2b$12$Nq54c1vXn01W6iO3gVsmx.L6tPZfRk3i1R4qW4k1g8b0wB3A8l6eO', 'WORKER', true),
(4, 'Lakshmi Devi (Worker)', 'lakshmi@example.com', '+91 97012 45678', '$2b$12$Nq54c1vXn01W6iO3gVsmx.L6tPZfRk3i1R4qW4k1g8b0wB3A8l6eO', 'WORKER', true),
(5, 'Anand Reddy (Hybrid)', 'anand@example.com', '+91 99887 65432', '$2b$12$Nq54c1vXn01W6iO3gVsmx.L6tPZfRk3i1R4qW4k1g8b0wB3A8l6eO', 'HYBRID', true)
ON CONFLICT (id) DO NOTHING;

-- Fix sequence
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

INSERT INTO farms (id, owner_id, name, area_acres, latitude, longitude, soil_info)
VALUES 
(1, 2, 'Sri Venkateswara Groundnut Farm', 3.5, 13.63, 79.40, 'Red sandy loam, optimal pH 6.5, good organic content'),
(2, 5, 'Sri Krishna Paddy & Vegetable Farm', 2.0, 13.62, 79.39, 'Clay loam, optimal for paddy and seasonal vegetables')
ON CONFLICT (id) DO NOTHING;
SELECT setval('farms_id_seq', (SELECT MAX(id) FROM farms));

INSERT INTO worker_profiles (user_id, skills, experience_years, latitude, longitude, available)
VALUES 
(3, '["harvesting", "ploughing", "weeding", "pod stripping"]'::jsonb, 5, 13.65, 79.42, true),
(4, '["weeding", "transplanting", "harvesting"]'::jsonb, 4, 13.61, 79.38, true),
(5, '["transplanting", "harvesting", "tractor operation"]'::jsonb, 6, 13.62, 79.39, true)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO jobs (id, farm_id, work_type, required_skill, workers_required, start_date, duration_days, wage_per_day, status)
VALUES (1, 1, 'Groundnut Harvesting & Pod Stripping', 'harvesting', 2, CURRENT_DATE + INTERVAL '1 day', 3, 550.0, 'OPEN')
ON CONFLICT (id) DO NOTHING;
SELECT setval('jobs_id_seq', (SELECT MAX(id) FROM jobs));

INSERT INTO market_prices (crop, market, district, state, arrival_date, min_price, max_price, modal_price)
VALUES 
('Groundnut', 'Tirupati APMC', 'Tirupati', 'Andhra Pradesh', CURRENT_DATE, 6200, 6800, 6500),
('Groundnut', 'Madanapalle APMC', 'Annamayya', 'Andhra Pradesh', CURRENT_DATE, 6100, 6750, 6450),
('Paddy', 'Nellore APMC', 'Nellore', 'Andhra Pradesh', CURRENT_DATE, 2183, 2300, 2250),
('Chilli', 'Guntur Mirchi Yard', 'Guntur', 'Andhra Pradesh', CURRENT_DATE, 16000, 21000, 18500),
('Cotton', 'Warangal APMC', 'Warangal', 'Telangana', CURRENT_DATE, 6800, 7400, 7150)
ON CONFLICT DO NOTHING;
