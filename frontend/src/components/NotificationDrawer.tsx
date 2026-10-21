import React from 'react';
import { Bell, CheckCheck, X, Calendar, UserCheck, AlertCircle, Briefcase, MapPin } from 'lucide-react';
import { Notification } from '../types';
import { api } from '../api';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onRefresh: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.notifications.markRead(id);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'BOOKING':
      case 'APPLICATION':
        return <UserCheck size={18} color="#22c55e" />;
      case 'JOB_ALERT':
      case 'NEW_JOB':
        return <Briefcase size={18} color="#38bdf8" />;
      case 'JOB_CANCELLED':
        return <AlertCircle size={18} color="#ef4444" />;
      default:
        return <Calendar size={18} color="#f59e0b" />;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ justifyContent: 'flex-end', padding: 0 }}>
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100vh',
          borderRadius: 0,
          background: 'rgba(15, 23, 42, 0.98)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'slideInRight 0.25s ease-out',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={20} color="#22c55e" />
            <h3 style={{ fontSize: '1.2rem' }}>Notifications</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '12px 24px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleMarkAllRead}
            className="btn-secondary btn-sm"
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', marginTop: 60 }}>
              <Bell size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: n.is_read
                    ? 'rgba(30, 41, 59, 0.4)'
                    : n.type === 'JOB_ALERT'
                    ? 'rgba(56, 189, 248, 0.12)'
                    : 'rgba(22, 163, 74, 0.1)',
                  border: n.is_read
                    ? '1px solid var(--border-subtle)'
                    : n.type === 'JOB_ALERT'
                    ? '1px solid rgba(56, 189, 248, 0.35)'
                    : '1px solid rgba(34, 197, 94, 0.3)',
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ marginTop: 2 }}>{getIcon(n.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ fontSize: '0.92rem', color: n.is_read ? '#cbd5e1' : '#f8fafc' }}>
                        {n.title}
                      </strong>
                      {!n.is_read && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: n.type === 'JOB_ALERT' ? '#38bdf8' : '#22c55e',
                          }}
                        />
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>{n.message}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {n.type === 'JOB_ALERT' && (
                        <span className="badge badge-blue" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                          📍 Nearby Alert
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
