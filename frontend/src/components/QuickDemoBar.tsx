import React, { useEffect, useState } from 'react';
import { Sparkles, Shield, UserPlus, ChevronDown, ChevronUp, CheckCircle, RotateCcw } from 'lucide-react';
import { api } from '../api';

interface QuickDemoBarProps {
  onSelectUser: (user: { token: string; user_id: number; name: string; role: string; email?: string }) => void;
  onOpenAuth: () => void;
  currentUser: any;
}

export const QuickDemoBar: React.FC<QuickDemoBarProps> = ({ onSelectUser, onOpenAuth, currentUser }) => {
  const [demoUsers, setDemoUsers] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const loadDemoUsers = () => {
    api.auth
      .getDemoUsers()
      .then(setDemoUsers)
      .catch((e) => console.log('Demo users fetch error:', e));
  };

  useEffect(() => {
    loadDemoUsers();
  }, []);

  const handleSelectDemo = (key: 'farmer' | 'worker' | 'hybrid' | 'admin') => {
    if (!demoUsers || !demoUsers[key]) return;
    const d = demoUsers[key];
    const userPayload = {
      token: d.token,
      user_id: d.user_id || (key === 'farmer' ? 2 : key === 'worker' ? 3 : key === 'hybrid' ? 4 : 1),
      name:
        d.name ||
        (key === 'farmer'
          ? 'Ravi Kumar (Farmer)'
          : key === 'worker'
          ? 'Suresh Naidu (Worker)'
          : key === 'hybrid'
          ? 'Anand Reddy (Hybrid)'
          : 'Platform Administrator'),
      email: d.email,
      role: d.role,
    };
    localStorage.setItem('agriconnect_token', d.token);
    localStorage.setItem('agriconnect_user', JSON.stringify(userPayload));
    onSelectUser(userPayload);
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset demo database to fresh initial state with default test accounts and farms?')) {
      return;
    }
    setResetting(true);
    try {
      const freshUsers = await api.auth.resetDemo();
      setDemoUsers(freshUsers);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3500);
      // Auto-re-login to current role if matching
      const currentRoleLower = currentUser?.role?.toLowerCase() as 'farmer' | 'worker' | 'hybrid' | 'admin' | undefined;
      if (currentRoleLower && freshUsers[currentRoleLower]) {
        handleSelectDemo(currentRoleLower);
      }
    } catch (e: any) {
      console.error('Demo reset error:', e);
      alert('Could not reset demo database: ' + (e.message || 'Server error'));
    } finally {
      setResetting(false);
    }
  };

  if (!isOpen) {
    return (
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '4px 20px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: '#94a3b8',
        }}
      >
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: '2px 12px',
            color: '#cbd5e1',
            fontSize: '0.74rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={12} color="#fbbf24" />
          <span>Evaluation Persona Switcher</span>
          <ChevronDown size={12} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(23, 37, 61, 0.98)',
        borderBottom: '1px solid rgba(251, 191, 36, 0.3)',
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: '0.85rem',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fbbf24' }}>
        <Sparkles size={16} />
        <span style={{ fontWeight: 600 }}>1-Click Evaluation Persona Switcher:</span>
        {resetSuccess && (
          <span style={{ color: '#86efac', fontSize: '0.78rem', marginLeft: 6 }}>
            ✓ Database refreshed to pristine demo state!
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => handleSelectDemo('farmer')}
          className={`btn-sm ${currentUser?.role === 'FARMER' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: 6 }}
        >
          <span>👨‍🌾</span>
          <span>Ravi (Farmer)</span>
          {currentUser?.role === 'FARMER' && <CheckCircle size={12} />}
        </button>

        <button
          onClick={() => handleSelectDemo('worker')}
          className={`btn-sm ${currentUser?.role === 'WORKER' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: 6 }}
        >
          <span>👷</span>
          <span>Suresh (Worker)</span>
          {currentUser?.role === 'WORKER' && <CheckCircle size={12} />}
        </button>

        <button
          onClick={() => handleSelectDemo('hybrid')}
          className={`btn-sm ${currentUser?.role === 'HYBRID' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: 6 }}
        >
          <span>🔄</span>
          <span>Anand (Hybrid)</span>
          {currentUser?.role === 'HYBRID' && <CheckCircle size={12} />}
        </button>

        <button
          onClick={() => handleSelectDemo('admin')}
          className={`btn-sm ${currentUser?.role === 'ADMIN' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: 6 }}
        >
          <Shield size={14} color="#38bdf8" />
          <span>Admin Portal</span>
          {currentUser?.role === 'ADMIN' && <CheckCircle size={12} />}
        </button>

        <button
          onClick={handleResetDemo}
          disabled={resetting}
          className="btn-sm btn-secondary"
          style={{ gap: 6, color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}
          title="Reset database to baseline test state"
        >
          <RotateCcw size={13} className={resetting ? 'spin' : ''} />
          <span>{resetting ? 'Resetting...' : 'Reset Demo Data'}</span>
        </button>

        <button
          onClick={onOpenAuth}
          className="btn-sm btn-secondary"
          style={{ gap: 6, color: '#38bdf8' }}
        >
          <UserPlus size={14} />
          <span>Real Login / Sign Up</span>
        </button>

        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: 4,
          }}
          title="Minimize switcher"
        >
          <ChevronUp size={16} />
        </button>
      </div>
    </div>
  );
};
