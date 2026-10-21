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
} from 'lucide-react';
import { api } from '../api';
import {
  CropRecommendationOut,
  DiseaseScanResponse,
  RagQueryResponse,
  MarketPrice,
  MarketOption,
} from '../types';
import { uploadCropScanImage } from '../supabase';

export const FarmAiHub: React.FC = () => {
  const [subTab, setSubTab] = useState<'disease' | 'advisor' | 'rag' | 'mandi'>('disease');

  // 1. Disease Scanner State
  const [selectedCrop, setSelectedCrop] = useState('Groundnut');
  const [sampleId, setSampleId] = useState('groundnut_tikka');
  const [scanResult, setScanResult] = useState<DiseaseScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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
  }, []);

  const handleRunScan = async (sample: string, crop: string) => {
    setScanning(true);
    setSampleId(sample);
    setSelectedCrop(crop);
    try {
      const res = await api.intelligence.scanDisease({ crop_name: crop, sample_id: sample });
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
    try {
      const publicUrl = await uploadCropScanImage(file);
      if (publicUrl) {
        setUploadedImageUrl(publicUrl);
      }
      await handleRunScan('uploaded_field_photo', selectedCrop);
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setUploadingImage(false);
    }
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
          <Sparkles size={26} color="#22c55e" /> Farm AI & Crop Intelligence Hub
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Evidence-grounded agronomic decision support, visual pest/disease diagnostics, RAG knowledge retrieval, and market pricing
        </p>
      </div>

      {/* Sub-tab Navigation */}
      <div className="tabs-container">
        <button
          onClick={() => setSubTab('disease')}
          className={`tab-btn ${subTab === 'disease' ? 'active' : ''}`}
        >
          <Camera size={16} /> 1. Crop Disease AI Scanner
        </button>
        <button
          onClick={() => setSubTab('advisor')}
          className={`tab-btn ${subTab === 'advisor' ? 'active' : ''}`}
        >
          <Compass size={16} /> 2. Crop Recommendation Advisor
        </button>
        <button
          onClick={() => setSubTab('rag')}
          className={`tab-btn ${subTab === 'rag' ? 'active' : ''}`}
        >
          <BookOpen size={16} /> 3. Agricultural RAG Assistant
        </button>
        <button
          onClick={() => setSubTab('mandi')}
          className={`tab-btn ${subTab === 'mandi' ? 'active' : ''}`}
        >
          <DollarSign size={16} /> 4. Mandi Prices & Net Return
        </button>
      </div>

      {/* ---------------- 1. CROP DISEASE SCANNER ---------------- */}
      {subTab === 'disease' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: 24 }}>
          {/* Sample Selector & Image Preview */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: 14 }}>Select Leaf Sample or Upload</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginBottom: 16 }}>
              Test visual symptom recognition across validated agricultural crop diseases:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { id: 'groundnut_tikka', name: 'Groundnut Tikka (Leaf Spot)', crop: 'Groundnut', badge: 'Fungal' },
                { id: 'paddy_blast', name: 'Rice / Paddy Blast (Magnaporthe)', crop: 'Paddy (Rice)', badge: 'Severe' },
                { id: 'cotton_leaf_curl', name: 'Cotton Leaf Curl Virus (CLCuV)', crop: 'Cotton', badge: 'Viral' },
                { id: 'tomato_early_blight', name: 'Tomato Early Blight (Alternaria)', crop: 'Tomato', badge: 'Target Rings' },
                { id: 'healthy_leaf', name: 'Healthy Groundnut Foliage', crop: 'Groundnut', badge: 'Normal' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleRunScan(s.id, s.crop)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: sampleId === s.id ? 'rgba(34, 197, 94, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                    border: sampleId === s.id ? '1px solid #22c55e' : '1px solid var(--border-subtle)',
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
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{s.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Crop: {s.crop}</div>
                  </div>
                  <span className="badge badge-amber">{s.badge}</span>
                </button>
              ))}
            </div>

            {/* Supabase Storage Leaf Upload & Camera Buttons */}
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  <span>{uploadingImage ? 'Uploading...' : '📸 Snap Photo'}</span>
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
                  <span>Upload File</span>
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
                  ✓ Stored in Supabase: <span style={{ textDecoration: 'underline' }}>{uploadedImageUrl.split('/').pop()}</span>
                </div>
              )}
            </div>

            {/* Visual Leaf Simulator Box */}
            <div
              style={{
                height: '180px',
                borderRadius: 'var(--radius-md)',
                background: uploadedImageUrl
                  ? `url(${uploadedImageUrl}) center/cover no-repeat`
                  : 'linear-gradient(135deg, rgba(5, 46, 22, 0.6) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: '1px dashed rgba(34, 197, 94, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                position: 'relative',
                overflow: 'hidden',
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
                    boxShadow: '0 0 12px #22c55e',
                    animation: 'scanLine 1.5s infinite linear',
                  }}
                />
              )}
              {!uploadedImageUrl && <span style={{ fontSize: '3rem' }}>🍃</span>}
              <span
                style={{
                  fontSize: '0.9rem',
                  color: '#cbd5e1',
                  fontWeight: 600,
                  background: 'rgba(15, 23, 42, 0.75)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {scanning ? 'Analyzing leaf pathology...' : `Sample Loaded: ${sampleId}`}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  background: 'rgba(15, 23, 42, 0.75)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Resolution: 1024x1024 | Supabase Storage Bucket: crop-scans
              </span>
            </div>
          </div>

          {/* Diagnostic Result Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {scanResult && (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <span className="badge badge-green">AI Model Diagnostic</span>
                    <h3 style={{ fontSize: '1.4rem', color: '#f8fafc', marginTop: 6 }}>
                      {scanResult.disease_name}
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.86rem' }}>
                      Identified on host crop: <strong style={{ color: '#cbd5e1' }}>{scanResult.crop_name}</strong>
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4ade80' }}>
                      {(scanResult.confidence * 100).toFixed(0)}%
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Model Confidence</span>
                  </div>
                </div>

                {/* Symptoms Observed */}
                <div style={{ marginTop: 18, padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-sm)' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#fbbf24' }}>Visual Symptoms Observed:</strong>
                  <p style={{ fontSize: '0.88rem', color: '#cbd5e1', marginTop: 4 }}>
                    {scanResult.symptoms}
                  </p>
                </div>

                {/* Organic Remedies */}
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: '0.95rem', color: '#86efac', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🌿 Recommended Organic & Cultural Management:
                  </h4>
                  <ul style={{ paddingLeft: 20, fontSize: '0.86rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {scanResult.organic_remedies.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Chemical Controls */}
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: '0.95rem', color: '#f87171', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🧪 Standard Chemical Interventions & Dosages:
                  </h4>
                  <ul style={{ paddingLeft: 20, fontSize: '0.86rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {scanResult.chemical_treatments.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                {/* Source Citation */}
                <div style={{ marginTop: 18, fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                  <strong>Source Authority:</strong> {scanResult.source_citation}
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
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Persisted in Supabase Cloud</span>
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
