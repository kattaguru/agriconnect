import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Briefcase,
  Star,
  CheckCircle2,
  Clock,
  Compass,
  Sliders,
  Send,
  Edit3,
  Calendar,
  AlertCircle,
  Navigation,
} from 'lucide-react';
import { api } from '../api';
import { Job, Booking, WorkerProfile } from '../types';
import { ReviewModal } from './ReviewModal';

export const MarketplaceWorker: React.FC = () => {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [nearbyJobs, setNearbyJobs] = useState<Job[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Search filters
  const [radiusKm, setRadiusKm] = useState(30);
  const [filterSkill, setFilterSkill] = useState('');

  // Modals & Actions
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  const [expYears, setExpYears] = useState('5');
  const [latInput, setLatInput] = useState('13.65');
  const [lonInput, setLonInput] = useState('79.42');
  const [isAvail, setIsAvail] = useState(true);

  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<number | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleDetectWorkerLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const liveLat = parseFloat(pos.coords.latitude.toFixed(4));
        const liveLon = parseFloat(pos.coords.longitude.toFixed(4));
        setLatInput(String(liveLat));
        setLonInput(String(liveLon));
        setDetectingGps(false);
        // Live search jobs immediately around detected location
        try {
          const jobs = await api.jobs.getNearby(liveLat, liveLon, radiusKm, filterSkill || undefined);
          setNearbyJobs(jobs);
          setActionMsg({ type: 'success', text: `Location detected: ${liveLat}°N, ${liveLon}°E. Showing nearest jobs.` });
        } catch (e) {
          console.error(e);
        }
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
      const [prof, books] = await Promise.all([
        api.workers.getMe(),
        api.bookings.getMine(),
      ]);
      setProfile(prof);
      setMyBookings(books);
      setSkillsInput(prof.skills.join(', '));
      setExpYears(String(prof.experience_years));
      setLatInput(prof.latitude ? String(prof.latitude) : '13.65');
      setLonInput(prof.longitude ? String(prof.longitude) : '79.42');
      setIsAvail(prof.available);

      // Fetch nearby jobs using worker's location
      const wLat = prof.latitude || 13.65;
      const wLon = prof.longitude || 79.42;
      const jobs = await api.jobs.getNearby(wLat, wLon, radiusKm, filterSkill || undefined);
      setNearbyJobs(jobs);
    } catch (e: any) {
      console.error('Failed to load worker data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [radiusKm, filterSkill]);

  const handleApply = async (jobId: number) => {
    setApplyingJobId(jobId);
    try {
      await api.jobs.apply(jobId);
      setActionMsg({ type: 'success', text: 'Application submitted! The farmer will review your profile.' });
      await fetchData();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to submit application' });
    } finally {
      setApplyingJobId(null);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setIsSavingProfile(true);
    try {
      const skillsArray = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.workers.updateMe({
        skills: skillsArray,
        experience_years: parseInt(expYears, 10) || 0,
        latitude: parseFloat(latInput),
        longitude: parseFloat(lonInput),
        available: isAvail,
      });
      setShowEditProfile(false);
      await fetchData();
      setActionMsg({ type: 'success', text: 'Worker profile updated successfully!' });
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleAvailability = async () => {
    if (!profile) return;
    try {
      const nextVal = !profile.available;
      await api.workers.updateMe({
        skills: profile.skills,
        experience_years: profile.experience_years,
        latitude: profile.latitude,
        longitude: profile.longitude,
        available: nextVal,
      });
      setProfile({ ...profile, available: nextVal });
      setIsAvail(nextVal);
      setActionMsg({
        type: 'success',
        text: nextVal ? 'You are now marked AVAILABLE for matching!' : 'You are now marked UNAVAILABLE.',
      });
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to toggle availability' });
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', color: '#f8fafc' }}>Worker Hub & Nearby Jobs</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Discover agricultural work around you, track confirmed bookings, and build reputation
          </p>
        </div>
        {profile && (
          <button
            onClick={toggleAvailability}
            className={`btn-sm ${profile.available ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: 6 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: profile.available ? '#4ade80' : '#64748b',
              }}
            />
            Status: {profile.available ? 'Available for Work' : 'Busy / Unavailable'}
          </button>
        )}
      </div>

      {/* Worker Profile Card */}
      {profile && (
        <div className="glass-panel" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ fontSize: '1.3rem', color: '#f8fafc' }}>{profile.name}</h3>
                <span className="badge badge-green">
                  {profile.available ? 'Active in Matching' : 'Unavailable'}
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginTop: 4 }}>
                📍 Base Location: {profile.latitude?.toFixed(2) || '13.65'}°N,{' '}
                {profile.longitude?.toFixed(2) || '79.42'}°E (Tirupati Region) | Experience:{' '}
                <strong style={{ color: '#f8fafc' }}>{profile.experience_years} Years</strong>
              </p>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {profile.skills.length === 0 ? (
                  <span style={{ fontSize: '0.82rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    ⚡ No skills added yet. Click "Edit Skills" to add your agricultural specialties (e.g. harvesting, weeding, ploughing).
                  </span>
                ) : (
                  profile.skills.map((s, idx) => (
                    <span
                      key={idx}
                      className="badge badge-amber"
                      style={{ fontSize: '0.8rem', padding: '4px 10px', textTransform: 'capitalize' }}
                    >
                      🌾 {s}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', color: '#fbbf24' }}>
                  <Star size={20} fill="#f59e0b" />
                  <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                    {profile.avg_rating ? profile.avg_rating.toFixed(1) : '5.0'}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>/5</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {profile.review_count} Verified Review{profile.review_count !== 1 ? 's' : ''}
                </div>
              </div>

              <button onClick={() => setShowEditProfile(true)} className="btn-secondary btn-sm">
                <Edit3 size={15} /> Edit Skills
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nearby Jobs Section */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Compass size={20} color="#22c55e" /> Open Farm Jobs Nearby ({nearbyJobs.length})
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Ranked nearest to your location using Haversine great-circle distance
            </p>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Radius:</span>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                style={{ cursor: 'pointer', accentColor: '#22c55e', width: '100px' }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4ade80', minWidth: '45px' }}>
                {radiusKm} km
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Skill:</span>
              <select
                className="form-select"
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
                value={filterSkill}
                onChange={(e) => setFilterSkill(e.target.value)}
              >
                <option value="">All Skills</option>
                <option value="harvesting">Harvesting</option>
                <option value="weeding">Weeding</option>
                <option value="ploughing">Ploughing</option>
                <option value="transplanting">Transplanting</option>
              </select>
            </div>

            <button
              onClick={handleDetectWorkerLocation}
              disabled={detectingGps}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem', borderColor: '#22c55e', color: '#86efac', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Detect real-time GPS location from your device"
            >
              <Navigation size={14} />
              <span>{detectingGps ? 'Querying GPS...' : '📍 Detect Live GPS'}</span>
            </button>
          </div>
        </div>

        {nearbyJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748b' }}>
            <p>No open farm jobs found within {radiusKm} km radius.</p>
            <p style={{ fontSize: '0.84rem', marginTop: 4 }}>Try increasing the search radius slider above.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {nearbyJobs.map((j) => (
              <div
                key={j.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h4 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{j.work_type}</h4>
                    <span className="badge badge-green">
                      📍 {j.distance_km ? `${j.distance_km} km away` : 'Nearby'}
                    </span>
                  </div>

                  <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginTop: 4 }}>
                    Farm: <strong style={{ color: '#cbd5e1' }}>{j.farm_name}</strong> | Start:{' '}
                    <strong style={{ color: '#cbd5e1' }}>{j.start_date}</strong> ({j.duration_days} days) | Needed:{' '}
                    <strong style={{ color: '#cbd5e1' }}>{j.workers_required} workers</strong>
                  </p>

                  <div style={{ marginTop: 6 }}>
                    <span className="badge badge-amber" style={{ fontSize: '0.74rem' }}>
                      Skill: {j.required_skill || 'General farm work'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4ade80' }}>
                      ₹{j.wage_per_day} <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/day</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Total pay ~₹{j.wage_per_day * j.duration_days}
                    </div>
                  </div>

                  <button
                    onClick={() => handleApply(j.id)}
                    className="btn-primary"
                    style={{ minWidth: '120px' }}
                    disabled={applyingJobId === j.id}
                  >
                    <Send size={16} /> {applyingJobId === j.id ? 'Applying...' : 'Apply Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Bookings Section */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Briefcase size={20} color="#0ea5e9" /> My Assigned Bookings & Work History ({myBookings.length})
        </h3>

        {myBookings.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            You haven't been assigned to any jobs yet. Apply to jobs above to get hired!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myBookings.map((b) => (
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
                    <strong style={{ fontSize: '1.02rem' }}>{b.work_type}</strong>
                    <span className={`badge ${b.status === 'CONFIRMED' ? 'badge-amber' : 'badge-green'}`}>
                      {b.status}
                    </span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 4 }}>
                    Hired on: {new Date(b.created_at).toLocaleDateString()}
                    {b.completed_at && ` | Completed on: ${new Date(b.completed_at).toLocaleDateString()}`}
                  </p>
                </div>

                <div>
                  {b.status === 'COMPLETED' && (
                    <button
                      onClick={() => setReviewBooking(b)}
                      className="btn-sm btn-secondary"
                      style={{ color: '#fbbf24' }}
                    >
                      <Star size={15} /> Rate Farmer
                    </button>
                  )}
                  {b.status === 'CONFIRMED' && (
                    <span style={{ fontSize: '0.84rem', color: '#fbbf24' }}>
                      ⏳ Work in progress
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: 14 }}>Update Worker Profile</h3>

            {profileError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  marginBottom: 14,
                  fontSize: '0.88rem',
                }}
              >
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label className="form-label">Skills (comma-separated)</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. harvesting, weeding, ploughing, spraying"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={handleDetectWorkerLocation}
                  disabled={detectingGps}
                  className="btn-secondary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.85rem', borderColor: '#22c55e', color: '#86efac' }}
                >
                  <Navigation size={15} />
                  <span>{detectingGps ? 'Querying Satellite GPS...' : '📍 Auto-Detect Base Coordinates via Device GPS'}</span>
                </button>
              </div>

              <div className="grid-cols-3">
                <div className="form-group">
                  <label className="form-label">Experience (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    required
                    className="form-input"
                    value={expYears}
                    onChange={(e) => setExpYears(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Base Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    className="form-input"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Base Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    className="form-input"
                    value={lonInput}
                    onChange={(e) => setLonInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#f8fafc' }}>
                  <input
                    type="checkbox"
                    checked={isAvail}
                    onChange={(e) => setIsAvail(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#22c55e' }}
                  />
                  <span>Mark as available for matching & new bookings</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowEditProfile(false);
                    setProfileError(null);
                  }}
                  disabled={isSavingProfile}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving Changes...' : 'Save Changes'}
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
          partnerName="Farmer"
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
