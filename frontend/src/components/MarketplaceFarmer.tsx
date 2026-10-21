import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Calendar,
  Users,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  Star,
  XCircle,
  AlertTriangle,
  Navigation,
  Mic,
  MicOff,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Bell,
  Radio,
} from 'lucide-react';
import { api } from '../api';
import { Farm, Job, Application, MatchCandidate, Booking } from '../types';
import { ReviewModal } from './ReviewModal';

export const MarketplaceFarmer: React.FC = () => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Active Selections
  const [showAddFarm, setShowAddFarm] = useState(false);
  const [showPostJob, setShowPostJob] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'applicants' | 'matches'>('matches');
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [loadingJobDetails, setLoadingJobDetails] = useState(false);

  // Review Modal state
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);

  // New Farm Form
  const [farmName, setFarmName] = useState('');
  const [farmAcres, setFarmAcres] = useState('3.5');
  const [farmLat, setFarmLat] = useState('13.63');
  const [farmLon, setFarmLon] = useState('79.40');
  const [soilInfo, setSoilInfo] = useState('Red sandy loam, optimal organic matter');

  // New Job Form
  const [selectedFarmId, setSelectedFarmId] = useState<number | ''>('');
  const [workType, setWorkType] = useState('Groundnut harvesting & pod stripping');
  const [reqSkill, setReqSkill] = useState('harvesting');
  const [workersReq, setWorkersReq] = useState('2');
  const [startDate, setStartDate] = useState('');
  const [durationDays, setDurationDays] = useState('3');
  const [wagePerDay, setWagePerDay] = useState('550');
  const [notifyRadiusKm, setNotifyRadiusKm] = useState<number>(50);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [postJobError, setPostJobError] = useState<string | null>(null);
  const [isPostingJob, setIsPostingJob] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'te-IN' | 'hi-IN'>('en-IN');
  const [expandedCandidateScores, setExpandedCandidateScores] = useState<Record<number, boolean>>({});

  const handleVoiceInput = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Voice dictation is supported in modern browsers like Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = voiceLang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListeningVoice(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setWorkType((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListeningVoice(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Voice input error:', event.error);
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListeningVoice(false);
    }
  };

  const handleDetectFarmLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFarmLat(pos.coords.latitude.toFixed(4));
        setFarmLon(pos.coords.longitude.toFixed(4));
        setDetectingGps(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        alert('Could not retrieve GPS location. Please check browser location permissions.');
        setDetectingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fData, jData, bData] = await Promise.all([
        api.farms.getMine(),
        api.jobs.getMine(),
        api.bookings.getMine(),
      ]);
      setFarms(fData);
      setJobs(jData);
      setBookings(bData);
      if (fData.length > 0) {
        setSelectedFarmId((prev) => (prev && fData.some((f) => f.id === prev) ? prev : fData[0].id));
      }
    } catch (e: any) {
      console.error('Failed to load farmer data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Default tomorrow's date for job start
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setStartDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  // Ensure selectedFarmId stays valid whenever farms list updates
  useEffect(() => {
    if (farms.length > 0 && (!selectedFarmId || !farms.some((f) => f.id === selectedFarmId))) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

  const handleSelectJob = async (jobId: number) => {
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
      return;
    }
    setSelectedJobId(jobId);
    setLoadingJobDetails(true);
    try {
      const [apps, mats] = await Promise.all([
        api.jobs.getApplications(jobId),
        api.jobs.getMatches(jobId),
      ]);
      setApplicants(apps);
      setMatches(mats);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingJobDetails(false);
    }
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newFarm = await api.farms.create({
        name: farmName,
        area_acres: parseFloat(farmAcres),
        latitude: parseFloat(farmLat),
        longitude: parseFloat(farmLon),
        soil_info: soilInfo,
      });
      setShowAddFarm(false);
      setSelectedFarmId(newFarm.id);
      await fetchData();
      setActionMsg({ type: 'success', text: `Farm "${farmName}" registered successfully!` });
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to create farm' });
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostJobError(null);

    const farmIdToUse = selectedFarmId ? Number(selectedFarmId) : (farms.length > 0 ? farms[0].id : null);
    if (!farmIdToUse) {
      setPostJobError('Please select or register a farmland first.');
      return;
    }

    if (!workType.trim()) {
      setPostJobError('Please specify the work type or operation.');
      return;
    }

    if (!startDate) {
      setPostJobError('Please select a valid start date.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate < todayStr) {
      setPostJobError('Start date cannot be in the past.');
      return;
    }

    const workersNum = parseInt(workersReq, 10);
    if (isNaN(workersNum) || workersNum < 1) {
      setPostJobError('Number of workers needed must be at least 1.');
      return;
    }

    const daysNum = parseInt(durationDays, 10);
    if (isNaN(daysNum) || daysNum < 1) {
      setPostJobError('Duration must be at least 1 day.');
      return;
    }

    const wageNum = parseFloat(wagePerDay);
    if (isNaN(wageNum) || wageNum < 1) {
      setPostJobError('Wage per day must be a positive number.');
      return;
    }

    setIsPostingJob(true);
    try {
      const created = await api.jobs.create({
        farm_id: Number(farmIdToUse),
        work_type: workType.trim(),
        required_skill: reqSkill.trim() || undefined,
        workers_required: workersNum,
        start_date: startDate,
        duration_days: daysNum,
        wage_per_day: wageNum,
        notify_radius_km: notifyRadiusKm,
      });
      setShowPostJob(false);
      setPostJobError(null);
      await fetchData();
      const count = created.notified_workers_count ?? 0;
      setActionMsg({
        type: 'success',
        text: `Job "${workType.trim()}" posted successfully! 📢 Broadcast notification sent to ${count} nearby worker${count === 1 ? '' : 's'} within ${notifyRadiusKm} km.`
      });
    } catch (err: any) {
      setPostJobError(err.message || 'Failed to post job. Please try again.');
    } finally {
      setIsPostingJob(false);
    }
  };

  const handleCancelJob = async (jobId: number) => {
    if (!window.confirm('Are you sure you want to cancel this job?')) return;
    try {
      await api.jobs.cancel(jobId);
      fetchData();
      if (selectedJobId === jobId) setSelectedJobId(null);
      setActionMsg({ type: 'success', text: 'Job cancelled successfully.' });
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to cancel job' });
    }
  };

  const handleAcceptApplication = async (appId: number) => {
    try {
      await api.applications.accept(appId);
      if (selectedJobId) handleSelectJob(selectedJobId);
      fetchData();
      setActionMsg({ type: 'success', text: 'Worker accepted! Confirmed booking created.' });
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to accept application' });
    }
  };

  const handleCompleteBooking = async (bookingId: number) => {
    try {
      await api.bookings.complete(bookingId);
      fetchData();
      setActionMsg({ type: 'success', text: 'Booking marked as completed! You can now rate the worker.' });
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to complete booking' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {actionMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: actionMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionMsg.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: actionMsg.type === 'success' ? '#86efac' : '#fca5a5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionMsg.text}</span>
          <button
            onClick={() => setActionMsg(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', color: '#f8fafc' }}>Farmer Operations Dashboard</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Manage farmlands, post labor requirements, and review algorithm-ranked candidates
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowAddFarm(true)} className="btn-secondary">
            <Plus size={18} /> Add Farm
          </button>
          <button
            onClick={() => {
              if (farms.length === 0) {
                setActionMsg({
                  type: 'error',
                  text: 'Please register your farmland first so candidates know the job location.',
                });
                setShowAddFarm(true);
              } else {
                setPostJobError(null);
                setShowPostJob(true);
              }
            }}
            className="btn-primary"
          >
            <Plus size={18} /> Post New Job
          </button>
        </div>
      </div>

      {/* Farms section */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={20} color="#22c55e" /> My Registered Farms ({farms.length})
        </h3>
        {farms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(34, 197, 94, 0.3)' }}>
            <span style={{ fontSize: '2.4rem' }}>🌾</span>
            <h4 style={{ color: '#f8fafc', fontSize: '1.15rem', marginTop: 8 }}>Welcome to Your Personal Farmer Space</h4>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', maxWidth: '460px', margin: '6px auto 16px' }}>
              You don't have any farmlands registered in your account yet. Register your land with live GPS coordinates to start posting jobs and hiring verified workers.
            </p>
            <button onClick={() => setShowAddFarm(true)} className="btn-primary" style={{ margin: '0 auto', gap: 8 }}>
              <Plus size={16} /> Register My First Farm
            </button>
          </div>
        ) : (
          <div className="grid-cols-3">
            {farms.map((f) => (
              <div
                key={f.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontSize: '1.05rem', color: '#f8fafc' }}>{f.name}</h4>
                  <span className="badge badge-green">{f.area_acres} Acres</span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 6 }}>
                  📍 {f.latitude.toFixed(2)}°N, {f.longitude.toFixed(2)}°E
                </p>
                {f.soil_info && (
                  <p style={{ color: '#cbd5e1', fontSize: '0.84rem', marginTop: 8, fontStyle: 'italic' }}>
                    "{f.soil_info}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Posted Jobs section */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={20} color="#f59e0b" /> Posted Farm Jobs ({jobs.length})
        </h3>

        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
            <p>No jobs posted yet. Click "Post New Job" to hire nearby agricultural workers.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {jobs.map((j) => {
              const isSelected = selectedJobId === j.id;
              return (
                <div
                  key={j.id}
                  style={{
                    background: isSelected ? 'rgba(22, 163, 74, 0.08)' : 'rgba(15, 23, 42, 0.5)',
                    border: isSelected ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '18px 20px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h4 style={{ fontSize: '1.15rem', color: '#f8fafc' }}>{j.work_type}</h4>
                        <span
                          className={`badge ${
                            j.status === 'OPEN'
                              ? 'badge-green'
                              : j.status === 'FILLED'
                              ? 'badge-amber'
                              : j.status === 'COMPLETED'
                              ? 'badge-blue'
                              : 'badge-red'
                          }`}
                        >
                          {j.status}
                        </span>
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginTop: 4 }}>
                        Farm: <strong style={{ color: '#cbd5e1' }}>{j.farm_name}</strong> | Start:{' '}
                        <strong style={{ color: '#cbd5e1' }}>{j.start_date}</strong> ({j.duration_days} days) | Required Skill:{' '}
                        <span className="badge badge-amber">{j.required_skill || 'General Labour'}</span>
                        {j.notified_workers_count !== undefined && j.notified_workers_count !== null && (
                          <span className="badge badge-blue" style={{ marginLeft: 8 }}>
                            📢 {j.notified_workers_count} Alerted
                          </span>
                        )}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4ade80' }}>
                          ₹{j.wage_per_day} <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/day</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {j.workers_required} worker{j.workers_required > 1 ? 's' : ''} needed
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectJob(j.id)}
                        className={`btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        {isSelected ? 'Hide Candidates' : 'Review Candidates'}
                      </button>

                      {j.status === 'OPEN' && (
                        <button
                          onClick={() => handleCancelJob(j.id)}
                          className="btn-sm btn-secondary"
                          style={{ color: '#f87171' }}
                          title="Cancel Job"
                        >
                          <XCircle size={16} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Candidates & Matching Drawer */}
                  {isSelected && (
                    <div
                      style={{
                        marginTop: 20,
                        paddingTop: 18,
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                        <button
                          onClick={() => setActiveTab('matches')}
                          className={`btn-sm ${activeTab === 'matches' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          <Sparkles size={15} /> Ranked Matches ({matches.length})
                        </button>
                        <button
                          onClick={() => setActiveTab('applicants')}
                          className={`btn-sm ${activeTab === 'applicants' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          <Users size={15} /> Applied Candidates ({applicants.length})
                        </button>
                      </div>

                      {loadingJobDetails ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                          Calculating optimal candidate ranking...
                        </div>
                      ) : activeTab === 'matches' ? (
                        <div>
                          <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: 12 }}>
                            Rule-based matching algorithm weights distance (40%), availability (20%), skill (20%), experience (10%), and reputation (10%).
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {matches.map((m, idx) => (
                              <div
                                key={m.worker_id}
                                style={{
                                  background: 'rgba(15, 23, 42, 0.7)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: 'var(--radius-md)',
                                  padding: '12px 16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: 12,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                  <div
                                    style={{
                                      width: 38,
                                      height: 38,
                                      borderRadius: '50%',
                                      background: idx === 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      color: idx === 0 ? '#4ade80' : '#cbd5e1',
                                      border: idx === 0 ? '1px solid #22c55e' : 'none',
                                    }}
                                  >
                                    #{idx + 1}
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{m.name}</strong>
                                      <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>
                                        Score: {(m.score * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                      {m.reasons.map((r, rIdx) => (
                                        <span
                                          key={rIdx}
                                          style={{
                                            fontSize: '0.74rem',
                                            padding: '2px 8px',
                                            borderRadius: 6,
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            color: '#cbd5e1',
                                          }}
                                        >
                                          ✓ {r}
                                        </span>
                                      ))}
                                    </div>

                                    {/* Transparent Score Breakdown Toggle */}
                                    <div style={{ marginTop: 8 }}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedCandidateScores((prev) => ({
                                            ...prev,
                                            [m.worker_id]: !prev[m.worker_id],
                                          }))
                                        }
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#38bdf8',
                                          fontSize: '0.74rem',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          padding: 0,
                                        }}
                                      >
                                        <BarChart2 size={12} />
                                        <span>
                                          {expandedCandidateScores[m.worker_id]
                                            ? 'Hide transparent formula breakdown'
                                            : 'View algorithm weight breakdown'}
                                        </span>
                                        {expandedCandidateScores[m.worker_id] ? (
                                          <ChevronUp size={12} />
                                        ) : (
                                          <ChevronDown size={12} />
                                        )}
                                      </button>

                                      {expandedCandidateScores[m.worker_id] && (
                                        <div
                                          style={{
                                            marginTop: 8,
                                            padding: '8px 12px',
                                            background: 'rgba(15, 23, 42, 0.9)',
                                            borderRadius: 8,
                                            border: '1px solid rgba(56, 189, 248, 0.25)',
                                            fontSize: '0.75rem',
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                            gap: 8,
                                          }}
                                        >
                                          <div>
                                            <span style={{ color: '#94a3b8' }}>Proximity (40%):</span>
                                            <div style={{ color: '#f8fafc', fontWeight: 600 }}>
                                              {m.distance_km != null ? `${m.distance_km} km away` : 'Near farm'}
                                            </div>
                                          </div>
                                          <div>
                                            <span style={{ color: '#94a3b8' }}>Skill Match (20%):</span>
                                            <div style={{ color: m.reasons.some((r) => r.includes('required skill')) ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                                              {m.reasons.some((r) => r.includes('required skill')) ? '✓ Direct Match' : 'Partial Match'}
                                            </div>
                                          </div>
                                          <div>
                                            <span style={{ color: '#94a3b8' }}>Availability (20%):</span>
                                            <div style={{ color: '#4ade80', fontWeight: 600 }}>
                                              Active & Open
                                            </div>
                                          </div>
                                          <div>
                                            <span style={{ color: '#94a3b8' }}>Reputation (10%):</span>
                                            <div style={{ color: '#fbbf24', fontWeight: 600 }}>
                                              {m.reasons.find((r) => r.includes('rated')) || 'Verified Worker'}
                                            </div>
                                          </div>
                                          <div>
                                            <span style={{ color: '#94a3b8' }}>Experience (10%):</span>
                                            <div style={{ color: '#f8fafc', fontWeight: 600 }}>
                                              {m.reasons.find((r) => r.includes('experience')) || 'Verified'}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  {applicants.some((a) => a.worker_id === m.worker_id) ? (
                                    <span className="badge badge-amber">Already Applied</span>
                                  ) : (
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                      Available in network
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          {applicants.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                              No workers have submitted applications yet.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {applicants.map((a) => (
                                <div
                                  key={a.id}
                                  style={{
                                    background: 'rgba(15, 23, 42, 0.7)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <div>
                                    <strong style={{ fontSize: '0.98rem' }}>{a.worker_name}</strong>
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                      Applied on: {new Date(a.applied_at).toLocaleDateString()}
                                    </p>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span
                                      className={`badge ${
                                        a.status === 'ACCEPTED'
                                          ? 'badge-green'
                                          : a.status === 'PENDING'
                                          ? 'badge-amber'
                                          : 'badge-red'
                                      }`}
                                    >
                                      {a.status}
                                    </span>

                                    {a.status === 'PENDING' && j.status === 'OPEN' && (
                                      <button
                                        onClick={() => handleAcceptApplication(a.id)}
                                        className="btn-sm btn-primary"
                                      >
                                        Accept & Hire
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bookings & Completion section */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={20} color="#10b981" /> Hired Workers & Bookings ({bookings.length})
        </h3>
        {bookings.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            No confirmed bookings yet. Accept applicants on open jobs above to confirm labor.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bookings.map((b) => (
              <div
                key={b.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '1.02rem' }}>{b.worker_name}</strong>
                    <span className={`badge ${b.status === 'CONFIRMED' ? 'badge-amber' : 'badge-green'}`}>
                      {b.status}
                    </span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 4 }}>
                    Job: {b.work_type} | Confirmed on: {new Date(b.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {b.status === 'CONFIRMED' && (
                    <button onClick={() => handleCompleteBooking(b.id)} className="btn-sm btn-primary">
                      Mark Completed
                    </button>
                  )}
                  {b.status === 'COMPLETED' && (
                    <button
                      onClick={() => setReviewBooking(b)}
                      className="btn-sm btn-secondary"
                      style={{ color: '#fbbf24' }}
                    >
                      <Star size={15} /> Rate Worker
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Farm Modal */}
      {showAddFarm && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: 14 }}>Register Farmland</h3>
            <form onSubmit={handleCreateFarm}>
              <div className="form-group">
                <label className="form-label">Farm / Land Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Sri Venkateswara Farm"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={handleDetectFarmLocation}
                  disabled={detectingGps}
                  className="btn-secondary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.85rem', borderColor: '#22c55e', color: '#86efac' }}
                >
                  <Navigation size={15} />
                  <span>{detectingGps ? 'Querying Satellite GPS...' : '📍 Auto-Detect Farm Coordinates via Device GPS'}</span>
                </button>
              </div>

              <div className="grid-cols-3">
                <div className="form-group">
                  <label className="form-label">Area (Acres)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    className="form-input"
                    value={farmAcres}
                    onChange={(e) => setFarmAcres(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    className="form-input"
                    value={farmLat}
                    onChange={(e) => setFarmLat(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    className="form-input"
                    value={farmLon}
                    onChange={(e) => setFarmLon(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Soil & Water Characteristics</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. Red sandy loam, borewell available..."
                  value={soilInfo}
                  onChange={(e) => setSoilInfo(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddFarm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Farm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Job Modal */}
      {showPostJob && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: 14 }}>Post Labor Requirement</h3>

            {postJobError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  marginBottom: 16,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{postJobError}</span>
              </div>
            )}

            <form onSubmit={handleCreateJob}>
              <div className="form-group">
                <label className="form-label">Select Farm</label>
                <select
                  className="form-select"
                  value={selectedFarmId || (farms.length > 0 ? farms[0].id : '')}
                  onChange={(e) => setSelectedFarmId(Number(e.target.value))}
                  required
                >
                  {farms.length === 0 ? (
                    <option value="">No registered farms found</option>
                  ) : (
                    farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.area_acres} acres)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Work Type / Operation</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select
                      value={voiceLang}
                      onChange={(e) => setVoiceLang(e.target.value as any)}
                      style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 4,
                        color: '#94a3b8',
                        fontSize: '0.72rem',
                        padding: '2px 4px',
                      }}
                      title="Voice Recognition Language"
                    >
                      <option value="en-IN">English (India)</option>
                      <option value="te-IN">తెలుగు (Telugu)</option>
                      <option value="hi-IN">हिंदी (Hindi)</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleVoiceInput}
                      style={{
                        background: isListeningVoice ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.15)',
                        border: `1px solid ${isListeningVoice ? '#ef4444' : '#22c55e'}`,
                        color: isListeningVoice ? '#fca5a5' : '#86efac',
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                      title="Dictate work requirements in your preferred language"
                    >
                      {isListeningVoice ? <MicOff size={13} /> : <Mic size={13} />}
                      <span>{isListeningVoice ? 'Listening...' : '🎙️ Speak to Fill'}</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Groundnut harvesting & pod stripping (or click Speak)"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                />
              </div>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Required Skill Tag</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. harvesting, weeding"
                    value={reqSkill}
                    onChange={(e) => setReqSkill(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Workers Needed</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="form-input"
                    value={workersReq}
                    onChange={(e) => setWorkersReq(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-cols-3">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="form-input"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Wage / Day (₹)</label>
                  <input
                    type="number"
                    min="100"
                    required
                    className="form-input"
                    value={wagePerDay}
                    onChange={(e) => setWagePerDay(e.target.value)}
                  />
                </div>
              </div>

              {/* Broadcast Notification Radius Control */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.06)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  marginTop: 14,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label
                    className="form-label"
                    style={{
                      marginBottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#38bdf8',
                      fontWeight: 600,
                    }}
                  >
                    <Bell size={16} /> Worker Notification Broadcast Range
                  </label>
                  <span
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.15)',
                      padding: '2px 10px',
                      borderRadius: 6,
                    }}
                  >
                    {notifyRadiusKm} km
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[10, 25, 50, 75, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNotifyRadiusKm(preset)}
                      style={{
                        padding: '3px 10px',
                        fontSize: '0.78rem',
                        borderRadius: 6,
                        border:
                          notifyRadiusKm === preset
                            ? '1px solid #38bdf8'
                            : '1px solid rgba(255, 255, 255, 0.12)',
                        background:
                          notifyRadiusKm === preset
                            ? 'rgba(56, 189, 248, 0.25)'
                            : 'rgba(15, 23, 42, 0.6)',
                        color: notifyRadiusKm === preset ? '#f8fafc' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {preset} km
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={notifyRadiusKm}
                  onChange={(e) => setNotifyRadiusKm(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />

                <p style={{ color: '#94a3b8', fontSize: '0.76rem', marginTop: 8, lineHeight: 1.4, marginBottom: 0 }}>
                  ⚡ <strong>Auto-alert:</strong> Registered workers within {notifyRadiusKm} km of this farm will automatically receive an instant notification on their dashboard once posted.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowPostJob(false);
                    setPostJobError(null);
                  }}
                  disabled={isPostingJob}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isPostingJob}>
                  {isPostingJob ? 'Publishing Job...' : 'Publish Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewBooking && (
        <ReviewModal
          isOpen={true}
          bookingId={reviewBooking.id}
          workType={reviewBooking.work_type}
          partnerName={reviewBooking.worker_name}
          onClose={() => setReviewBooking(null)}
          onSuccess={() => {
            fetchData();
            setActionMsg({ type: 'success', text: 'Thank you! Rating recorded.' });
          }}
        />
      )}
    </div>
  );
};
