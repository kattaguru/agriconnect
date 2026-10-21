import {
  AdminMetrics,
  Application,
  AuditLog,
  Booking,
  CropRecommendationOut,
  DiseaseScanResponse,
  Farm,
  Job,
  MatchCandidate,
  MarketOption,
  MarketPrice,
  Notification,
  RagQueryResponse,
  SimulationOutput,
  User,
  UserAdmin,
  WorkerProfile,
  Role,
} from './types';

const API_BASE = '/api';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('agriconnect_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = { ...getHeaders(), ...(options.headers || {}) };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    if (
      res.status === 401 &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/register') &&
      !endpoint.includes('/auth/phone/verify-otp')
    ) {
      localStorage.removeItem('agriconnect_token');
      localStorage.removeItem('agriconnect_user');
      window.dispatchEvent(new CustomEvent('agriconnect_session_expired'));
    }
    let errMessage = 'Request failed';
    try {
      const data = await res.json();
      if (Array.isArray(data?.detail)) {
        errMessage = data.detail.map((d: any) => d.msg || (typeof d === 'string' ? d : JSON.stringify(d))).join('; ');
      } else if (typeof data?.detail === 'string') {
        errMessage = data.detail;
      } else if (data?.message) {
        errMessage = data.message;
      } else if (data) {
        errMessage = JSON.stringify(data);
      }
    } catch {
      errMessage = res.statusText || `Error ${res.status}`;
    }
    throw new Error(errMessage);
  }
  if (res.status === 204) {
    return {} as T;
  }
  return res.json();
}

export const api = {
  // Auth
  auth: {
    register: (body: { name: string; email: string; password: string; role: string; phone?: string }) =>
      request<{ token: string; user_id: number; name: string; role: Role; email?: string; phone?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    login: (body: { identifier?: string; email?: string; phone?: string; password: string }) =>
      request<{ token: string; user_id: number; name: string; role: Role; email?: string; phone?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    oauthSync: (body: { email: string; name: string; role?: string; phone?: string | null; provider?: string }) =>
      request<{ token: string; user_id: number; name: string; role: Role; email?: string; phone?: string }>('/auth/oauth-sync', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    sendPhoneOtp: (body: { phone: string }) =>
      request<{ status: string; message: string; phone: string; is_existing_user: boolean; demo_otp?: string }>('/auth/phone/send-otp', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    verifyPhoneOtp: (body: { phone: string; otp: string; name?: string; role?: string }) =>
      request<{ token: string; user_id: number; name: string; role: Role; email?: string; phone?: string }>('/auth/phone/verify-otp', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateRole: (role: Role) =>
      request<{ token: string; user_id: number; name: string; role: Role; email?: string; phone?: string }>('/auth/me/role', {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
    getDemoUsers: () => request<Record<string, { user_id?: number; name?: string; email: string; role: string; token: string }>>('/demo/users'),
    resetDemo: () => request<Record<string, { user_id?: number; name?: string; email: string; role: string; token: string }>>('/demo/reset', { method: 'POST' }),
  },

  // Farms
  farms: {
    getMine: () => request<Farm[]>('/farms/mine'),
    create: (body: { name: string; area_acres: number; latitude: number; longitude: number; soil_info?: string }) =>
      request<Farm>('/farms', { method: 'POST', body: JSON.stringify(body) }),
  },

  // Jobs
  jobs: {
    getOpen: () => request<Job[]>('/jobs'),
    getMine: () => request<Job[]>('/jobs/mine'),
    getNearby: (lat: number, lon: number, radiusKm: number = 50, skill?: string) => {
      const q = new URLSearchParams({ lat: String(lat), lon: String(lon), radius_km: String(radiusKm) });
      if (skill) q.append('skill', skill);
      return request<Job[]>(`/jobs/nearby?${q.toString()}`);
    },
    getDetails: (id: number) => request<Job>(`/jobs/${id}`),
    create: (body: {
      farm_id: number;
      work_type: string;
      required_skill?: string;
      workers_required: number;
      start_date: string;
      duration_days: number;
      wage_per_day: number;
      notify_radius_km?: number;
    }) => request<Job>('/jobs', { method: 'POST', body: JSON.stringify(body) }),
    cancel: (id: number) => request<Job>(`/jobs/${id}/cancel`, { method: 'PATCH' }),
    apply: (id: number) => request<Application>(`/jobs/${id}/apply`, { method: 'POST' }),
    getApplications: (id: number) => request<Application[]>(`/jobs/${id}/applications`),
    getMatches: (id: number) => request<MatchCandidate[]>(`/jobs/${id}/matches`),
  },

  // Applications & Bookings
  applications: {
    accept: (id: number) => request<Booking>(`/applications/${id}/accept`, { method: 'POST' }),
  },
  bookings: {
    getMine: () => request<Booking[]>('/bookings/mine'),
    complete: (id: number) => request<Booking>(`/bookings/${id}/complete`, { method: 'POST' }),
  },

  // Reviews
  reviews: {
    create: (body: { booking_id: number; rating: number; comment?: string }) =>
      request<{ id: number; rating: number; comment?: string }>('/reviews', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  // Workers
  workers: {
    getMe: () => request<WorkerProfile>('/workers/me'),
    updateMe: (body: {
      skills: string[];
      experience_years: number;
      latitude?: number | null;
      longitude?: number | null;
      available: boolean;
    }) => request<WorkerProfile>('/workers/me', { method: 'PUT', body: JSON.stringify(body) }),
    getWorker: (userId: number) => request<WorkerProfile>(`/workers/${userId}`),
  },

  // Profit Simulator
  simulations: {
    calculate: (body: any) => request<SimulationOutput>('/simulations/calculate', { method: 'POST', body: JSON.stringify(body) }),
    getAverageWage: () => request<{ average_wage_per_day: number; sample_count: number }>('/simulations/average-wage'),
    save: (body: { farm_id?: number | null; crop_name: string; area_acres: number; inputs: any; results: any }) =>
      request<any>('/simulations/save', { method: 'POST', body: JSON.stringify(body) }),
    getMine: () => request<any[]>('/simulations/mine'),
    delete: (id: number) => request<void>(`/simulations/${id}`, { method: 'DELETE' }),
  },

  // Notifications
  notifications: {
    get: () => request<Notification[]>('/notifications'),
    getUnreadCount: () => request<{ unread_count: number }>('/notifications/unread-count'),
    markRead: (id: number) => request<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request<{ status: string }>('/notifications/read-all', { method: 'POST' }),
  },

  // Intelligence
  intelligence: {
    recommendCrops: (body: any) => request<CropRecommendationOut>('/intelligence/crop-recommendation', { method: 'POST', body: JSON.stringify(body) }),
    scanDisease: (body: { crop_name: string; sample_id?: string; image_base64?: string }) =>
      request<DiseaseScanResponse>('/intelligence/disease-scan', { method: 'POST', body: JSON.stringify(body) }),
    getScanHistory: () => request<any[]>('/intelligence/scan-history'),
    queryRag: (body: { question: string; crop?: string }) =>
      request<RagQueryResponse>('/intelligence/rag-query', { method: 'POST', body: JSON.stringify(body) }),
    getMarketPrices: (crop?: string, district?: string) => {
      const q = new URLSearchParams();
      if (crop) q.append('crop', crop);
      if (district) q.append('district', district);
      return request<MarketPrice[]>(`/intelligence/market-prices?${q.toString()}`);
    },
    compareMarkets: (body: { crop: string; quantity_qtl: number; current_lat: number; current_lon: number; transport_cost_per_km_qtl?: number }) =>
      request<{ crop: string; quantity_qtl: number; options: MarketOption[]; recommended_market: string }>(
        '/intelligence/market-compare',
        { method: 'POST', body: JSON.stringify(body) }
      ),
  },

  // Admin
  admin: {
    getMetrics: () => request<AdminMetrics>('/admin/metrics'),
    getUsers: () => request<UserAdmin[]>('/admin/users'),
    suspendUser: (id: number) => request<UserAdmin>(`/admin/users/${id}/suspend`, { method: 'POST' }),
    getAuditLogs: () => request<AuditLog[]>('/admin/audit-logs'),
  },
};
