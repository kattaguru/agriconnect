import React, { useState } from 'react';
import { X, Check, Sprout, Briefcase, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { Role, User } from '../types';
import { api } from '../api';

interface RoleSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onRoleUpdated: (updatedUser: User) => void;
}

export const RoleSwitchModal: React.FC<RoleSwitchModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onRoleUpdated,
}) => {
  const [selectedRole, setSelectedRole] = useState<Role>(currentUser?.role || 'FARMER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !currentUser) return null;

  const handleSave = async () => {
    if (selectedRole === currentUser.role) {
      onClose();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.auth.updateRole(selectedRole);
      const updated: User = {
        id: res.user_id,
        name: res.name,
        email: res.email || currentUser.email,
        phone: res.phone || currentUser.phone,
        role: res.role,
        token: res.token,
      };

      localStorage.setItem('agriconnect_token', res.token);
      localStorage.setItem('agriconnect_user', JSON.stringify(updated));
      onRoleUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        style={{
          maxWidth: '520px',
          width: '92%',
          padding: '28px 24px',
          background: 'linear-gradient(180deg, #131f33 0%, #0c1524 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} color="#60a5fa" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Select Workspace Role
              </h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0 }}>
              Choose your profile capability: Only Farmer, Only Worker, or Hybrid (Both).
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Role Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
          {/* 1. Only Farmer */}
          <div
            onClick={() => setSelectedRole('FARMER')}
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              background:
                selectedRole === 'FARMER'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(255, 255, 255, 0.03)',
              border:
                selectedRole === 'FARMER'
                  ? '2px solid #22c55e'
                  : '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>👨‍🌾</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.96rem' }}>
                  Only Farmer
                </span>
                {selectedRole === 'FARMER' && (
                  <span
                    style={{
                      background: '#22c55e',
                      color: '#0f172a',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Own land, register farms, post agricultural job requirements, hire verified laborers, and run crop profit simulations.
              </p>
            </div>
          </div>

          {/* 2. Only Worker */}
          <div
            onClick={() => setSelectedRole('WORKER')}
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              background:
                selectedRole === 'WORKER'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(255, 255, 255, 0.03)',
              border:
                selectedRole === 'WORKER'
                  ? '2px solid #22c55e'
                  : '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>👷</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.96rem' }}>
                  Only Worker
                </span>
                {selectedRole === 'WORKER' && (
                  <span
                    style={{
                      background: '#22c55e',
                      color: '#0f172a',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Maintain worker skills, browse nearby agricultural job openings, apply directly to local farmers, and receive wage bookings.
              </p>
            </div>
          </div>

          {/* 3. Hybrid (Both Farmer & Worker) */}
          <div
            onClick={() => setSelectedRole('HYBRID')}
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              background:
                selectedRole === 'HYBRID'
                  ? 'rgba(59, 130, 246, 0.18)'
                  : 'rgba(255, 255, 255, 0.03)',
              border:
                selectedRole === 'HYBRID'
                  ? '2px solid #3b82f6'
                  : '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>🔄</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.96rem' }}>
                  Hybrid (Both Farmer & Worker)
                </span>
                {selectedRole === 'HYBRID' && (
                  <span
                    style={{
                      background: '#3b82f6',
                      color: '#ffffff',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                <strong style={{ color: '#93c5fd' }}>All-in-One Dual Workspace!</strong> Post jobs to hire laborers on your farmland, and search/apply for agricultural work on other farms whenever you want extra income.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '10px 18px', fontSize: '0.88rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '10px 22px',
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {loading ? <RefreshCw className="spin" size={16} /> : null}
            <span>{loading ? 'Updating...' : 'Save & Switch Role'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
