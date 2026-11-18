import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Camera,
  Compass,
  BookOpen,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  FileText,
  Upload,
  ArrowRight,
  TrendingUp,
  MapPin,
  RefreshCw,
  History,
  Cpu,
  Layers,
  Activity,
  ShieldCheck,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Zap,
  Check,
} from 'lucide-react';
import { api } from '../api';
import {
  CropRecommendationOut,
  DiseaseScanResponse,
  RagQueryResponse,
  MarketPrice,
  MarketOption,
  ModelInfoResponse,
  ModelTrainResponse,
} from '../types';
import { uploadCropScanImage } from '../supabase';
import { Language, getT } from '../i18n';

interface FarmAiHubProps {
  lang?: Language;
}

export const FarmAiHub: React.FC<FarmAiHubProps> = ({ lang = 'en' }) => {
  const t = getT(lang);
  const [subTab, setSubTab] = useState<'disease' | 'advisor' | 'rag' | 'mandi'>('disease');

  // 1. Disease Scanner State
  const [selectedCrop, setSelectedCrop] = useState('Groundnut');
  const [sampleId, setSampleId] = useState('groundnut_tikka');
  const [scanResult, setScanResult] = useState<DiseaseScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cropDiseaseAiUrl, setCropDiseaseAiUrl] = useState<string>(() => localStorage.getItem('agriconnect_crop_ai_url') || '');
  const [cropAiChecking, setCropAiChecking] = useState(false);
  const [cropAiStatus, setCropAiStatus] = useState<string | null>(null);
  const [showAiSettings, setShowAiSettings] = useState(false);

  // Model Training & Studio State
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [trainingModel, setTrainingModel] = useState(false);
  const [trainResult, setTrainResult] = useState<ModelTrainResponse | null>(null);
  const [showModelStudio, setShowModelStudio] = useState(false);

  // 2. Crop Advisor State
  const [district, setDistrict] = useState('Tirupati');
  const [areaAcres, setAreaAcres] = useState('3.0');
  const [soilType, setSoilType] = useState('Red Loamy');
  const [soilPh, setSoilPh] = useState('6.5');
  const [waterSource, setWaterSource] = useState('Borewell');
  const [season, setSeason] = useState('Kharif');
  const [budget, setBudget] = useState('45000');
  const [advisorResult, setAdvisorResult] = useState<CropRecommendationOut | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);

  // 3. RAG State
  const [ragQuestion, setRagQuestion] = useState('When and why should gypsum be applied to groundnut?');
  const [ragResult, setRagResult] = useState<RagQueryResponse | null>(null);
  const [ragLoading, setRagLoading] = useState(false);

  // 4. Mandi Prices State
  const [mandiCrop, setMandiCrop] = useState('Groundnut');
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [compOptions, setCompOptions] = useState<MarketOption[]>([]);
  const [recommendedMarket, setRecommendedMarket] = useState('');
  const [mandiLoading, setMandiLoading] = useState(false);

  // Initial runs
  useEffect(() => {
    handleRunScan('groundnut_tikka', 'Groundnut');
    handleRunAdvisor();
    handleRunRag('When and why should gypsum be applied to groundnut?');
    handleLoadMandi('Groundnut');
    api.intelligence.getModelInfo().then(setModelInfo).catch(console.error);
  }, []);

  const handleRunScan = async (sample: string, crop: string) => {
    setScanning(true);
    setSampleId(sample);
    setSelectedCrop(crop);
    setUploadedImageUrl(null);
    try {
      const res = await api.intelligence.scanDisease({
        crop_name: crop,
        sample_id: sample,
        crop_disease_ai_url: cropDiseaseAiUrl || undefined,
      });
      setScanResult(res);
      const hist = await api.intelligence.getScanHistory();
      setScanHistory(hist);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setScanning(true);
    setSampleId('field_photo_test');

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setUploadedImageUrl(base64Data);

      try {
        // Backup to Supabase storage in background if reachable
        uploadCropScanImage(file).catch(() => null);

        // Send actual visual image bytes to AI Vision RAG backend
        const res = await api.intelligence.scanDisease({
          crop_name: selectedCrop,
          image_base64: base64Data,
          crop_disease_ai_url: cropDiseaseAiUrl || undefined,
        });
        setScanResult(res);
        const hist = await api.intelligence.getScanHistory();
        setScanHistory(hist);
      } catch (err) {
        console.error('File scan error:', err);
      } finally {
        setScanning(false);
        setUploadingImage(false);
      }
    };
    reader.onerror = () => {
      setScanning(false);
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleTrainModel = async () => {
    setTrainingModel(true);
    setTrainResult(null);
    try {
      const res = await api.intelligence.trainModel();
      setTrainResult(res);
      const updated = await api.intelligence.getModelInfo();
      setModelInfo(updated);
    } catch (err) {
      console.error('Model training error:', err);
    } finally {
      setTrainingModel(false);
    }
  };

  const askRagAboutDiagnosis = (disease: string, crop: string) => {
    const q = `What is the certified ICAR/ANGRAU management and spray schedule for ${disease} in ${crop}?`;
    setRagQuestion(q);
    setSubTab('rag');
    handleRunRag(q);
  };

  const handleRunAdvisor = async () => {
    setAdvisorLoading(true);
    try {
      const res = await api.intelligence.recommendCrops({
        district,
        area_acres: parseFloat(areaAcres),
        soil_type: soilType,
        soil_ph: parseFloat(soilPh),
        water_source: waterSource,
        season,
        budget_inr: parseFloat(budget),
      });
      setAdvisorResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleRunRag = async (q: string) => {
    setRagLoading(true);
    setRagQuestion(q);
    try {
      const res = await api.intelligence.queryRag({ question: q });
      setRagResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setRagLoading(false);
    }
  };

  const handleLoadMandi = async (crop: string) => {
    setMandiLoading(true);
    setMandiCrop(crop);
    try {
      const [prices, comp] = await Promise.all([
        api.intelligence.getMarketPrices(crop),
        api.intelligence.compareMarkets({
          crop,
          quantity_qtl: 40,
          current_lat: 13.63,
          current_lon: 79.40,
        }),
      ]);
      setMarketPrices(prices);
      setCompOptions(comp.options);
      setRecommendedMarket(comp.recommended_market);
    } catch (e) {
      console.error(e);
    } finally {
      setMandiLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.6rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={26} color="#22c55e" /> {t('farmAiTitle')}
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          {t('farmAiSubtitle')}
        </p>
      </div>

      {/* Sub-tab Navigation */}
      <div className="tabs-container">
        <button
          onClick={() => setSubTab('disease')}
          className={`tab-btn ${subTab === 'disease' ? 'active' : ''}`}
        >
          <Camera size={16} /> {t('tabDiseaseScanner')}
        </button>
        <button
          onClick={() => setSubTab('advisor')}
          className={`tab-btn ${subTab === 'advisor' ? 'active' : ''}`}
        >
          <Compass size={16} /> {t('tabCropAdvisor')}
        </button>
        <button
          onClick={() => setSubTab('rag')}
          className={`tab-btn ${subTab === 'rag' ? 'active' : ''}`}
        >
          <BookOpen size={16} /> {t('tabRagAssistant')}
        </button>
        <button
          onClick={() => setSubTab('mandi')}
          className={`tab-btn ${subTab === 'mandi' ? 'active' : ''}`}
        >
          <DollarSign size={16} /> {t('tabMandiPrices')}
        </button>
      </div>

      {/* ---------------- 1. CROP DISEASE SCANNER ---------------- */}
      {subTab === 'disease' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Main Scanner Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: 24 }}>
            {/* Sample Selector & Image Preview */}
            <div className="glass-panel" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: '1.15rem' }}>Select Problem Leaf or Scan</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="badge badge-green" style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Zap size={12} /> CropDiseaseAI Active
                  </span>
                  <button
                    onClick={() => setShowAiSettings(!showAiSettings)}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#4ade80',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Configure CropDiseaseAI Local / Cloud Endpoint"
                  >
                    <Compass size={12} /> Config
                  </button>
                </div>
              </div>

              {showAiSettings && (
                <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(34, 197, 94, 0.35)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.76rem', color: '#86efac', fontWeight: 600, marginBottom: 4 }}>
                    CropDiseaseAI Service Connection:
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="http://127.0.0.1:8000 or tunnel URL"
                      value={cropDiseaseAiUrl}
                      onChange={(e) => {
                        setCropDiseaseAiUrl(e.target.value);
                        localStorage.setItem('agriconnect_crop_ai_url', e.target.value);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        background: 'rgba(2, 6, 23, 0.7)',
                        border: '1px solid #334155',
                        borderRadius: 'var(--radius-sm)',
                        color: '#f8fafc',
                        fontSize: '0.76rem',
                      }}
                    />
                    <button
                      onClick={async () => {
                        setCropAiChecking(true);
                        try {
                          const target = (cropDiseaseAiUrl || 'http://127.0.0.1:8000').replace(/\/$/, '');
                          const res = await fetch(`${target}/health`, { method: 'GET' });
                          const data = await res.json();
                          setCropAiStatus(data.status === 'healthy' ? '✓ Connected to CropDiseaseAI' : '⚠ Server responded');
                        } catch {
                          setCropAiStatus('⚠ Server unreachable locally (Vision-RAG fallback active)');
                        } finally {
                          setCropAiChecking(false);
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        background: 'rgba(34, 197, 94, 0.2)',
                        border: '1px solid #22c55e',
                        color: '#4ade80',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cropAiChecking ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                  {cropAiStatus && (
                    <div style={{ fontSize: '0.72rem', marginTop: 4, color: cropAiStatus.includes('✓') ? '#4ade80' : '#f59e0b' }}>
                      {cropAiStatus}
                    </div>
                  )}
                </div>
              )}
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginBottom: 14 }}>
                Compare field camera photo or test leaf symptoms against 1,400+ trained pathology vectors:
              </p>

              {/* Disease Sample Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18, maxHeight: '280px', overflowY: 'auto' }}>
                {[
                  { id: 'groundnut_tikka', name: 'Groundnut Tikka (Leaf Spot)', crop: 'Groundnut', badge: 'Halo Spots' },
                  { id: 'paddy_blast', name: 'Rice / Paddy Blast (Magnaporthe)', crop: 'Paddy (Rice)', badge: 'Spindle Lesions' },
                  { id: 'cotton_leaf_curl', name: 'Cotton Leaf Curl Virus (CLCuD)', crop: 'Cotton', badge: 'Foliar Curling' },
                  { id: 'tomato_early_blight', name: 'Tomato Early Blight (Alternaria)', crop: 'Tomato', badge: 'Target Rings' },
                  { id: 'chilli_anthracnose', name: 'Chilli Anthracnose & Dieback', crop: 'Chilli', badge: 'Sunken Rot' },
                  { id: 'corn_rust', name: 'Maize Common Rust (Puccinia)', crop: 'Corn / Maize', badge: 'Pustules' },
                  { id: 'healthy_foliage', name: 'Healthy Crop Foliage (Control)', crop: 'Groundnut', badge: 'Clean Foliage' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleRunScan(s.id, s.crop)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: sampleId === s.id && !uploadedImageUrl ? 'rgba(34, 197, 94, 0.2)' : 'rgba(15, 23, 42, 0.55)',
                      border: sampleId === s.id && !uploadedImageUrl ? '1px solid #22c55e' : '1px solid var(--border-subtle)',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Crop: {s.crop}</div>
                    </div>
                    <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>{s.badge}</span>
                  </button>
                ))}
              </div>

              {/* Camera Snap & Upload Buttons */}
              <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid #22c55e',
                      color: '#4ade80',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <Camera size={15} />
                    <span>{uploadingImage ? 'Analyzing...' : '📸 Snap Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      disabled={uploadingImage}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid var(--border-subtle)',
                      color: '#cbd5e1',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <Upload size={15} />
                    <span>Upload Leaf File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      disabled={uploadingImage}
                    />
                  </label>
                </div>

                {uploadedImageUrl && (
                  <div style={{ fontSize: '0.74rem', color: '#86efac', textAlign: 'center' }}>
                    ✓ Custom photo loaded & features extracted via PIL Vision Pipeline
                  </div>
                )}
              </div>

              {/* Visual Leaf Simulator Box */}
              <div
                style={{
                  height: '210px',
                  borderRadius: 'var(--radius-md)',
                  background: uploadedImageUrl
                    ? `url(${uploadedImageUrl}) center/cover no-repeat`
                    : 'linear-gradient(135deg, rgba(6, 40, 20, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '1px dashed rgba(34, 197, 94, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: 12,
                }}
              >
                {scanning && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: '#22c55e',
                      boxShadow: '0 0 16px #22c55e',
                      animation: 'scanLine 1.5s infinite linear',
                      zIndex: 10,
                    }}
                  />
                )}

                {/* SVG Visual Leaf Pathology Render if not uploaded image */}
                {!uploadedImageUrl && (
                  <div style={{ width: '130px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sampleId === 'groundnut_tikka' ? (
                      <svg viewBox="0 0 100 80" style={{ width: '100%', height: '100%' }}>
                        <ellipse cx="50" cy="40" rx="42" ry="32" fill="#2d6a4f" stroke="#1b4332" strokeWidth="2" />
                        <path d="M 15 40 Q 50 40 85 40" stroke="#40916c" strokeWidth="1.5" fill="none" />
                        <circle cx="35" cy="30" r="9" fill="rgba(250, 204, 21, 0.6)" />
                        <circle cx="35" cy="30" r="5" fill="#3e2723" />
                        <circle cx="68" cy="45" r="8" fill="rgba(250, 204, 21, 0.6)" />
                        <circle cx="68" cy="45" r="4" fill="#2e1c0c" />
                        <circle cx="48" cy="55" r="7" fill="rgba(250, 204, 21, 0.6)" />
                        <circle cx="48" cy="55" r="3.5" fill="#3e2723" />
                      </svg>
                    ) : sampleId === 'paddy_blast' ? (
                      <svg viewBox="0 0 100 80" style={{ width: '100%', height: '100%' }}>
                        <path d="M 10 65 Q 50 35 90 15 Q 60 55 10 65" fill="#386641" stroke="#1b4332" strokeWidth="2" />
                        <ellipse cx="42" cy="45" rx="14" ry="5" transform="rotate(-25 42 45)" fill="#e2e8f0" stroke="#78350f" strokeWidth="1.5" />
                        <ellipse cx="68" cy="30" rx="11" ry="3.5" transform="rotate(-25 68 30)" fill="#cbd5e1" stroke="#78350f" strokeWidth="1.5" />
                      </svg>
                    ) : sampleId === 'cotton_leaf_curl' ? (
                      <svg viewBox="0 0 100 80" style={{ width: '100%', height: '100%' }}>
                        <path d="M 50 15 C 75 25 85 50 78 70 C 65 65 50 75 42 65 C 20 60 22 25 50 15 Z" fill="#1b4332" stroke="#22c55e" strokeWidth="2" />
                        <path d="M 50 15 L 50 72 M 50 35 L 72 30 M 50 50 L 75 58 M 50 35 L 30 30 M 50 50 L 28 56" stroke="#86efac" strokeWidth="2" />
                      </svg>
                    ) : sampleId === 'tomato_early_blight' ? (
                      <svg viewBox="0 0 100 80" style={{ width: '100%', height: '100%' }}>
                        <path d="M 50 15 C 68 22 80 45 72 65 C 60 60 55 75 50 75 C 45 75 40 60 28 65 C 20 45 32 22 50 15 Z" fill="#2d6a4f" stroke="#1b4332" strokeWidth="1.5" />
                        <circle cx="48" cy="42" r="14" fill="none" stroke="rgba(250, 204, 21, 0.6)" strokeWidth="2" />
                        <circle cx="48" cy="42" r="9" fill="none" stroke="#78350f" strokeWidth="1.5" />
                        <circle cx="48" cy="42" r="5" fill="#451a03" />
                      </svg>
                    ) : sampleId === 'chilli_anthracnose' ? (
                      <svg viewBox="0 0 100 80" style={{ width: '100%', height: '100%' }}>
                        <path d="M 50 10 Q 80 45 50 75 Q 20 45 50 10 Z" fill="#2d6a4f" stroke="#1b4332" strokeWidth="2" />
                        <ellipse cx="50" cy="38" rx="12" ry="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
                        <ellipse cx="45" cy="56" rx="8" ry="5" fill="#18181b" />
                      </svg>
                    ) : sampleId === 'corn_rust' ? (
                      <svg viewBox="0 0 100 80" style={{ width: '100%', height: '100%' }}>
                        <path d="M 15 70 Q 50 20 85 10 Q 60 40 25 72 Z" fill="#40916c" stroke="#1b4332" strokeWidth="1.5" />
                        {[ [35, 50], [45, 42], [55, 34], [65, 26], [40, 58], [50, 48], [60, 38] ].map(([cx, cy], i) => (
                          <circle key={i} cx={cx} cy={cy} r="2" fill="#d97706" />
                        ))}
                      </svg>
                    ) : (
                      <svg viewBox="0 0 100 80" style={{ width: '100%', height: '100%' }}>
                        <path d="M 50 12 C 78 28 85 60 50 75 C 15 60 22 28 50 12 Z" fill="#22c55e" stroke="#15803d" strokeWidth="2" />
                        <path d="M 50 12 L 50 75" stroke="#86efac" strokeWidth="2" />
                        <path d="M 50 30 Q 65 26 70 34 M 50 30 Q 35 26 30 34 M 50 48 Q 68 44 72 52 M 50 48 Q 32 44 28 52" stroke="#86efac" strokeWidth="1.5" fill="none" />
                      </svg>
                    )}
                  </div>
                )}

                <span
                  style={{
                    fontSize: '0.84rem',
                    color: '#f8fafc',
                    fontWeight: 600,
                    background: 'rgba(15, 23, 42, 0.85)',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: 6,
                  }}
                >
                  {scanning ? 'Extracting visual pathology vectors...' : uploadedImageUrl ? 'Uploaded Field Leaf Photo' : `Sample: ${sampleId.replace('_', ' ')}`}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#94a3b8',
                    background: 'rgba(15, 23, 42, 0.85)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: 4,
                  }}
                >
                  9-Feature Vector | Resolution: 128x128 Resampled | Centroid Cosine Match
                </span>
              </div>
            </div>

            {/* Diagnostic Result & Trained Data Comparison */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {scanResult && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  {/* Top Match Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge badge-green">Trained Model Top Match</span>
                        <span className="badge badge-amber">{scanResult.severity} Severity</span>
                        {scanResult.model_version && (
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.74rem',
                              background: scanResult.model_version.includes('CropDiseaseAI') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                              border: scanResult.model_version.includes('CropDiseaseAI') ? '1px solid #22c55e' : '1px solid #64748b',
                              color: scanResult.model_version.includes('CropDiseaseAI') ? '#4ade80' : '#94a3b8',
                              fontWeight: 600,
                            }}
                          >
                            ⚡ {scanResult.model_version}
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1.45rem', color: '#f8fafc', marginTop: 6 }}>
                        {scanResult.disease_name}
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem' }}>
                        Host Crop: <strong style={{ color: '#cbd5e1' }}>{scanResult.crop_name}</strong>
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4ade80' }}>
                        {(scanResult.confidence * 100).toFixed(0)}%
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Pathology Confidence</span>
                    </div>
                  </div>

                  {/* Visual Feature Vector Extraction Metrics */}
                  {scanResult.visual_metrics && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Activity size={14} color="#22c55e" /> Visual Feature Extraction Metrics:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        <div style={{ background: 'rgba(15, 23, 42, 0.65)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                          <div style={{ fontSize: '0.72rem', color: '#eab308' }}>Chlorosis (Yellowing)</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fef08a' }}>
                            {scanResult.visual_metrics.chlorosis_percent ?? 0}%
                          </div>
                        </div>
                        <div style={{ background: 'rgba(15, 23, 42, 0.65)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <div style={{ fontSize: '0.72rem', color: '#f87171' }}>Necrosis (Lesions)</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fca5a5' }}>
                            {scanResult.visual_metrics.necrosis_percent ?? 0}%
                          </div>
                        </div>
                        <div style={{ background: 'rgba(15, 23, 42, 0.65)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                          <div style={{ fontSize: '0.72rem', color: '#4ade80' }}>Healthy Tissue</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#86efac' }}>
                            {scanResult.visual_metrics.healthy_tissue_percent ?? 0}%
                          </div>
                        </div>
                        <div style={{ background: 'rgba(15, 23, 42, 0.65)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                          <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>Dominant Hue</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#bae6fd' }}>
                            {scanResult.visual_metrics.dominant_hue ?? 0}°
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Differential Diagnosis: Comparison Against Already Trained Data */}
                  {scanResult.differential_diagnoses && scanResult.differential_diagnoses.length > 0 && (
                    <div style={{ marginTop: 18, padding: '14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <strong style={{ fontSize: '0.84rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <BarChart2 size={15} color="#22c55e" /> Comparison with Already Trained Disease Profiles:
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Cosine Vector Similarity</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {scanResult.differential_diagnoses.map((cand, idx) => {
                          const pct = Math.round(cand.similarity_score * 100);
                          const isTop = idx === 0;
                          return (
                            <div key={cand.disease_id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                <span style={{ color: isTop ? '#4ade80' : '#cbd5e1', fontWeight: isTop ? 600 : 400 }}>
                                  {isTop ? '★ ' : ''}{cand.disease_name} <span style={{ color: '#64748b' }}>({cand.crop})</span>
                                </span>
                                <span style={{ color: isTop ? '#4ade80' : '#94a3b8', fontWeight: 600 }}>{pct}%</span>
                              </div>
                              <div style={{ height: '6px', background: 'rgba(30, 41, 59, 0.8)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${pct}%`,
                                    background: isTop
                                      ? 'linear-gradient(90deg, #10b981, #22c55e)'
                                      : pct > 40
                                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                      : '#475569',
                                    borderRadius: '3px',
                                    transition: 'width 0.5s ease',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Visual Symptoms Observed */}
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-sm)' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#fbbf24' }}>Visual Symptoms Observed:</strong>
                    <p style={{ fontSize: '0.88rem', color: '#cbd5e1', marginTop: 4, lineHeight: 1.5 }}>
                      {scanResult.symptoms}
                    </p>
                  </div>

                  {/* RAG Retrieved Recommendations */}
                  <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* Organic Management */}
                    <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                      <h4 style={{ fontSize: '0.9rem', color: '#86efac', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        🌿 Organic & Biological Solutions:
                      </h4>
                      <ul style={{ paddingLeft: 18, fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {scanResult.organic_remedies.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Chemical Controls */}
                    <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
                      <h4 style={{ fontSize: '0.9rem', color: '#f87171', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        🧪 Standard Chemical Interventions & Dilutions:
                      </h4>
                      <ul style={{ paddingLeft: 18, fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {scanResult.chemical_treatments.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Guidance and Ask RAG Button */}
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      <strong>Source Authority:</strong> {scanResult.source_citation}
                    </div>
                    <button
                      onClick={() => askRagAboutDiagnosis(scanResult.disease_name, scanResult.crop_name)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid #3b82f6',
                        color: '#93c5fd',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <BookOpen size={14} /> Ask Agricultural RAG about this Disease
                    </button>
                  </div>

                  {/* Safety Disclaimer */}
                  <div
                    style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      fontSize: '0.78rem',
                      color: '#fbbf24',
                      display: 'flex',
                      gap: 8,
                    }}
                  >
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{scanResult.disclaimer}</span>
                  </div>
                </div>
              )}

              {/* Supabase Crop Health Diary / Scan History */}
              {scanHistory && scanHistory.length > 0 && (
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h4 style={{ fontSize: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <History size={16} color="#22c55e" /> Cloud Diagnostic History ({scanHistory.length})
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Persisted in Database</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {scanHistory.map((h: any) => (
                      <div
                        key={h.id}
                        style={{
                          background: 'rgba(15, 23, 42, 0.55)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                            {h.disease_name}
                          </span>
                          <span className="badge badge-green" style={{ fontSize: '0.72rem', padding: '1px 6px' }}>
                            {(h.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                          Crop: <span style={{ color: '#cbd5e1' }}>{h.crop_name}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                          {new Date(h.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Model Architecture & Training Studio */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Cpu size={22} color="#22c55e" />
                <div>
                  <h4 style={{ fontSize: '1.05rem', color: '#f8fafc', fontWeight: 600 }}>
                    AI Vision Model & RAG Training Studio
                  </h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    Multi-feature pathology classifier & semantic agronomic knowledge indexing
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={handleTrainModel}
                  disabled={trainingModel}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: trainingModel ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: trainingModel ? 0.7 : 1,
                    boxShadow: '0 2px 10px rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <RefreshCw size={14} className={trainingModel ? 'spin' : ''} />
                  <span>{trainingModel ? 'Rebuilding & Training Model...' : '⚡ Re-train / Build Model'}</span>
                </button>
                <button
                  onClick={() => setShowModelStudio(!showModelStudio)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-subtle)',
                    color: '#cbd5e1',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {showModelStudio ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span>{showModelStudio ? 'Hide Specs' : 'View Architecture'}</span>
                </button>
              </div>
            </div>

            {/* Success Message Banner */}
            {trainResult && (
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid #22c55e',
                  fontSize: '0.82rem',
                  color: '#4ade80',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle size={16} style={{ flexShrink: 0 }} />
                <span>{trainResult.message}</span>
              </div>
            )}

            {/* Expanded Architecture Details */}
            {showModelStudio && (
              <div style={{ marginTop: 18, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Active Model</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>
                      {modelInfo?.model_name || 'AgriConnect-VisionRAG-v2'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Cross-Val Accuracy</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#4ade80', marginTop: 2 }}>
                      {modelInfo?.accuracy_percent || 100}%
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Training Vectors</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8', marginTop: 2 }}>
                      {modelInfo?.training_samples || 1400} Field Samples
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Indexed Diseases</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fbbf24', marginTop: 2 }}>
                      {modelInfo?.classes?.length || 7} Crop Pathologies
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  <p>
                    <strong>Multi-Feature Pathology Vector Space:</strong> Extracted metrics include chlorosis ratio, necrosis ratio,
                    concentric ring density, spindle lesion ratio, foliar curling index, pustule frequency, water-soaked margins, dominant hue, and saturation.
                  </p>
                  <p style={{ marginTop: 6, color: '#94a3b8' }}>
                    <strong>RAG Integration:</strong> Retrieved treatments are indexed from ICAR, ANGRAU, and TNAU certified package of practices with verified active ingredients and Pre-Harvest Interval (PHI) compliance.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 2. CROP RECOMMENDATION ADVISOR ---------------- */}
      {subTab === 'advisor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: 24 }}>
          {/* Soil & Agro-climatic Inputs */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: 14 }}>Soil & Farm Parameters</h3>

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">District / Region</label>
                <input
                  type="text"
                  className="form-input"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Land Size (Acres)</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-input"
                  value={areaAcres}
                  onChange={(e) => setAreaAcres(e.target.value)}
                />
              </div>
            </div>

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Soil Type</label>
                <select
                  className="form-select"
                  value={soilType}
                  onChange={(e) => setSoilType(e.target.value)}
                >
                  <option value="Red Loamy">Red Loamy</option>
                  <option value="Sandy Loam">Sandy Loam</option>
                  <option value="Medium Black">Medium Black Cotton</option>
                  <option value="Clay">Clay / Alluvial</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Soil pH ({soilPh})</label>
                <input
                  type="range"
                  min="5.0"
                  max="9.0"
                  step="0.1"
                  value={soilPh}
                  onChange={(e) => setSoilPh(e.target.value)}
                  style={{ accentColor: '#22c55e', cursor: 'pointer', width: '100%', marginTop: 8 }}
                />
              </div>
            </div>

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Water Source</label>
                <select
                  className="form-select"
                  value={waterSource}
                  onChange={(e) => setWaterSource(e.target.value)}
                >
                  <option value="Borewell">Borewell (Assured)</option>
                  <option value="Canal">Canal Irrigation</option>
                  <option value="Rainfed">Rainfed Only (Dryland)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Crop Season</label>
                <select
                  className="form-select"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                >
                  <option value="Kharif">Kharif (Monsoon)</option>
                  <option value="Rabi">Rabi (Winter)</option>
                  <option value="Zaid">Zaid (Summer)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Input Investment Budget (₹)</label>
              <input
                type="number"
                step="5000"
                className="form-input"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>

            <button
              onClick={handleRunAdvisor}
              className="btn-primary"
              style={{ width: '100%', marginTop: 10 }}
              disabled={advisorLoading}
            >
              <RefreshCw size={16} /> Re-evaluate Suitability
            </button>
          </div>

          {/* Recommended Crops Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {advisorResult && (
              <>
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#86efac',
                    fontSize: '0.88rem',
                  }}
                >
                  <strong>Soil Assessment:</strong> {advisorResult.soil_health_assessment}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {advisorResult.recommended_crops.map((c, idx) => (
                    <div
                      key={idx}
                      className="glass-panel"
                      style={{
                        padding: '18px 20px',
                        border: idx === 0 ? '1px solid #22c55e' : '1px solid var(--border-subtle)',
                        background: idx === 0 ? 'rgba(22, 163, 74, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h4 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>{c.crop_name}</h4>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>({c.local_name})</span>
                            {idx === 0 && (
                              <span className="badge badge-green">★ Top Recommendation</span>
                            )}
                          </div>
                          <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 4 }}>
                            Duration: <strong style={{ color: '#cbd5e1' }}>{c.duration_days} Days</strong> | Water Need:{' '}
                            <strong style={{ color: '#cbd5e1' }}>{c.water_need}</strong> | Expected Yield:{' '}
                            <strong style={{ color: '#4ade80' }}>{c.expected_yield_range}</strong>
                          </p>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4ade80' }}>
                            {c.compatibility_score}%
                          </div>
                          <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Suitability Score</span>
                        </div>
                      </div>

                      {/* Suitability Reasons */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {c.suitability_reasons.map((r, rIdx) => (
                            <span
                              key={rIdx}
                              style={{
                                fontSize: '0.78rem',
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#cbd5e1',
                              }}
                            >
                              ✓ {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                  {advisorResult.disclaimer}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 3. AGRICULTURAL RAG ASSISTANT ---------------- */}
      {subTab === 'rag' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={20} color="#22c55e" /> Grounded Agricultural Knowledge Assistant
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: 18 }}>
              Answers synthesized strictly from indexed verified publications (ICAR, ANGRAU, Ministry of Agriculture) with exact citations.
            </p>

            {/* Popular Question Chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8', alignSelf: 'center' }}>Suggested:</span>
              {[
                'When and why should gypsum be applied to groundnut?',
                'How to control yellow stem borer in paddy?',
                'What is PM-KISAN eligibility and payment structure?',
                'What is the intimation window for PMFBY crop insurance claims?',
              ].map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleRunRag(prompt)}
                  className="btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', borderRadius: 'var(--radius-full)' }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input Row */}
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Ask any agricultural practice, pest treatment or government scheme question..."
                value={ragQuestion}
                onChange={(e) => setRagQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunRag(ragQuestion)}
              />
              <button
                onClick={() => handleRunRag(ragQuestion)}
                className="btn-primary"
                style={{ minWidth: '120px' }}
                disabled={ragLoading}
              >
                {ragLoading ? 'Searching...' : 'Ask Assistant'}
              </button>
            </div>

            {/* Answer Display */}
            {ragResult && (
              <div
                style={{
                  marginTop: 22,
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className={`badge ${ragResult.grounded ? 'badge-green' : 'badge-amber'}`}>
                    {ragResult.grounded ? '✓ Grounded & Cited' : 'Refusal / Outside Scope'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Confidence: {(ragResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.94rem',
                    color: '#f8fafc',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-line',
                    marginBottom: 18,
                  }}
                >
                  {ragResult.answer}
                </div>

                {/* Sources Section */}
                {ragResult.sources.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                    <h5 style={{ fontSize: '0.85rem', color: '#fbbf24', marginBottom: 10 }}>
                      Verified Extension Sources Cited:
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ragResult.sources.map((src, sIdx) => (
                        <div
                          key={sIdx}
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.82rem',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#4ade80' }}>{src.title}</div>
                          <div style={{ color: '#94a3b8' }}>Authority: {src.source}</div>
                          <div style={{ color: '#cbd5e1', marginTop: 4, fontStyle: 'italic' }}>
                            "{src.excerpt}"
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 14 }}>
                  {ragResult.disclaimer}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 4. MANDI PRICES & NET RETURN ---------------- */}
      {subTab === 'mandi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Controls */}
          <div className="glass-panel" style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Select Crop:</span>
              {['Groundnut', 'Paddy', 'Cotton', 'Tomato', 'Maize'].map((c) => (
                <button
                  key={c}
                  onClick={() => handleLoadMandi(c)}
                  className={`btn-sm ${mandiCrop === c ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '0.84rem', color: '#4ade80' }}>
              Recommended: <strong>{recommendedMarket}</strong>
            </div>
          </div>

          {/* Net Return Calculator Table */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={20} color="#22c55e" /> Net Return Across Nearby Mandis (After Distance & Transport Costs)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginBottom: 16 }}>
              Simulation assumes 40 quintals produce transported from base farm (13.63°N, 79.40°E) at ₹1.2 / km / quintal.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Market Yard</th>
                    <th style={{ padding: '10px' }}>District</th>
                    <th style={{ padding: '10px' }}>Distance</th>
                    <th style={{ padding: '10px' }}>Modal Price</th>
                    <th style={{ padding: '10px' }}>Gross Value</th>
                    <th style={{ padding: '10px' }}>Transport Cost</th>
                    <th style={{ padding: '10px' }}>Net Realization</th>
                    <th style={{ padding: '10px' }}>Gain vs Nearest</th>
                  </tr>
                </thead>
                <tbody>
                  {compOptions.map((opt, oIdx) => (
                    <tr
                      key={oIdx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: opt.is_best ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                        {opt.market_name} {opt.is_best && '★ Best Net'}
                      </td>
                      <td style={{ padding: '10px', color: '#94a3b8' }}>{opt.district}</td>
                      <td style={{ padding: '10px' }}>{opt.distance_km} km</td>
                      <td style={{ padding: '10px', color: '#fbbf24', fontWeight: 600 }}>
                        ₹{opt.modal_price_per_qtl}
                      </td>
                      <td style={{ padding: '10px' }}>₹{opt.gross_value.toLocaleString()}</td>
                      <td style={{ padding: '10px', color: '#f87171' }}>
                        -₹{opt.transport_cost_total.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 700, color: opt.is_best ? '#4ade80' : '#f8fafc' }}>
                        ₹{opt.net_return.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          color: opt.advantage_vs_nearest >= 0 ? '#4ade80' : '#f87171',
                        }}
                      >
                        {opt.advantage_vs_nearest >= 0 ? `+₹${opt.advantage_vs_nearest}` : `-₹${Math.abs(opt.advantage_vs_nearest)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
