export type Role = 'FARMER' | 'WORKER' | 'HYBRID' | 'ADMIN' | 'AGRI_EXPERT';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  token?: string;
}

export interface Farm {
  id: number;
  name: string;
  area_acres: number;
  latitude: number;
  longitude: number;
  soil_info?: string | null;
}

export interface Job {
  id: number;
  farm_id: number;
  farm_name: string;
  work_type: string;
  required_skill?: string | null;
  workers_required: number;
  start_date: string;
  duration_days: number;
  wage_per_day: number;
  status: 'OPEN' | 'FILLED' | 'COMPLETED' | 'CANCELLED';
  distance_km?: number | null;
  notified_workers_count?: number | null;
}

export interface Application {
  id: number;
  job_id: number;
  worker_id: number;
  worker_name: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  applied_at: string;
}

export interface Booking {
  id: number;
  job_id: number;
  work_type: string;
  worker_id: number;
  worker_name: string;
  status: 'CONFIRMED' | 'COMPLETED';
  created_at: string;
  completed_at?: string | null;
}

export interface WorkerProfile {
  id: number;
  name: string;
  skills: string[];
  experience_years: number;
  latitude?: number | null;
  longitude?: number | null;
  available: boolean;
  avg_rating?: number | null;
  review_count: number;
}

export interface MatchCandidate {
  worker_id: number;
  name: string;
  score: number;
  distance_km?: number | null;
  reasons: string[];
}

export interface ScenarioRow {
  scenario: string;
  yield_qtl: number;
  selling_price: number;
  gross_revenue: number;
  total_cost: number;
  net_profit: number;
  profit_per_acre: number;
  roi_percent: number;
}

export interface SellingOptionOut {
  name: string;
  market_price: number;
  net_price_per_qtl: number;
  total_gross: number;
  net_profit: number;
  extra_transport_and_storage: number;
  is_best: boolean;
  notes: string;
}

export interface SimulationOutput {
  crop_name: string;
  area_acres: number;
  gross_revenue: number;
  total_cost: number;
  net_profit: number;
  profit_per_acre: number;
  break_even_price: number;
  break_even_yield: number;
  cost_breakdown: Record<string, number>;
  scenarios: ScenarioRow[];
  selling_options: SellingOptionOut[];
  sensitivity: Record<string, number>;
  disclaimer: string;
}

export interface CandidateCrop {
  crop_name: string;
  local_name: string;
  compatibility_score: number;
  duration_days: number;
  expected_yield_range: string;
  water_need: string;
  profit_potential: string;
  suitability_reasons: string[];
  warnings: string[];
}

export interface CropRecommendationOut {
  recommended_crops: CandidateCrop[];
  soil_health_assessment: string;
  disclaimer: string;
}

export interface DiseaseScanResponse {
  crop_name: string;
  disease_name: string;
  confidence: number;
  severity: string;
  is_uncertain: boolean;
  symptoms: string;
  organic_remedies: string[];
  chemical_treatments: string[];
  guidance_notes: string;
  source_citation: string;
  disclaimer: string;
}

export interface RagSourceDoc {
  title: string;
  source: string;
  relevance_score: number;
  excerpt: string;
}

export interface RagQueryResponse {
  question: string;
  answer: string;
  grounded: boolean;
  sources: RagSourceDoc[];
  confidence: number;
  disclaimer: string;
}

export interface MarketPrice {
  id: number;
  crop: string;
  market: string;
  district: string;
  state: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  source: string;
  trend: string;
}

export interface MarketOption {
  market_name: string;
  district: string;
  distance_km: number;
  modal_price_per_qtl: number;
  gross_value: number;
  transport_cost_total: number;
  net_return: number;
  is_best: boolean;
  advantage_vs_nearest: number;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link?: string | null;
  created_at: string;
}

export interface AdminMetrics {
  total_users: number;
  total_farmers: number;
  total_workers: number;
  total_jobs: number;
  open_jobs: number;
  filled_jobs: number;
  completed_jobs: number;
  total_bookings: number;
  completed_bookings: number;
  total_reviews: number;
  avg_platform_rating?: number | null;
  total_scans: number;
  total_simulations: number;
}

export interface UserAdmin {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  action: string;
  resource: string;
  details?: string | null;
  created_at: string;
}
