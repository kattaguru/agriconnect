import React, { useEffect, useState } from 'react';
import {
  Shield,
  Users,
  Briefcase,
  Star,
  Activity,
  AlertTriangle,
  UserX,
  UserCheck,
  FileText,
  Clock,
} from 'lucide-react';
import { api } from '../api';
import { AdminMetrics, UserAdmin, AuditLog } from '../types';

export const AdminPortal: React.FC = () => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [m, u, a] = await Promise.all([
        api.admin.getMetrics(),
        api.admin.getUsers(),
        api.admin.getAuditLogs(),
      ]);
      setMetrics(m);
      setUsers(u);
      setAuditLogs(a);
    } catch (e: any) {
      console.error(e);
      setMsg(e.message || 'Error fetching admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleSuspend = async (userId: number) => {
    try {
      await api.admin.suspendUser(userId);
      fetchData();
      setMsg('User status updated successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      setMsg(err.message || 'Failed to update user status');
      setTimeout(() => setMsg(''), 4000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.6rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={26} color="#38bdf8" /> Platform Administration & Governance Portal
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Real-time metrics, user management, trust verification, and immutable security audit logs
        </p>
      </div>

      {msg && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(14, 165, 233, 0.15)',
            border: '1px solid #0ea5e9',
            color: '#7dd3fc',
            fontSize: '0.88rem',
          }}
        >
          {msg}
        </div>
      )}

      {/* KPI Metrics Grid */}
      {metrics && (
        <div className="grid-cols-4">
          <div className="glass-panel" style={{ padding: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Users</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              {metrics.total_users}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#4ade80' }}>
              {metrics.total_farmers} Farmers | {metrics.total_workers} Workers
            </span>
          </div>

          <div className="glass-panel" style={{ padding: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Marketplace Jobs</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
              {metrics.total_jobs}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#7dd3fc' }}>
              {metrics.open_jobs} Open | {metrics.completed_jobs} Completed
            </span>
          </div>

          <div className="glass-panel" style={{ padding: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Bookings & Hires</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
              {metrics.total_bookings}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#fde68a' }}>
              {metrics.completed_bookings} Completed Work
            </span>
          </div>

          <div className="glass-panel" style={{ padding: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>AI Scans & Sim</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c084fc', marginTop: 4 }}>
              {metrics.total_scans + metrics.total_simulations}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#e9d5ff' }}>
              {metrics.total_scans} Scans | {metrics.total_simulations} Sim
            </span>
          </div>
        </div>
      )}

      {/* User Directory */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={20} color="#22c55e" /> Registered Users Management ({users.length})
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>User ID</th>
                <th style={{ padding: '10px' }}>Name</th>
                <th style={{ padding: '10px' }}>Email</th>
                <th style={{ padding: '10px' }}>Role</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px' }}>Registered</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px 10px', color: '#64748b' }}>#{u.id}</td>
                  <td style={{ padding: '10px', fontWeight: 600, color: '#f8fafc' }}>{u.name}</td>
                  <td style={{ padding: '10px', color: '#cbd5e1' }}>{u.email}</td>
                  <td style={{ padding: '10px' }}>
                    <span
                      className={`badge ${
                        u.role === 'FARMER'
                          ? 'badge-green'
                          : u.role === 'WORKER'
                          ? 'badge-amber'
                          : 'badge-blue'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', color: '#94a3b8', fontSize: '0.82rem' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    {u.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleToggleSuspend(u.id)}
                        className={`btn-sm ${u.is_active ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ fontSize: '0.78rem', color: u.is_active ? '#f87171' : 'white' }}
                      >
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Audit Trail */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={20} color="#f59e0b" /> Immutable Security Audit Logs ({auditLogs.length})
        </h3>
        <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Timestamp</th>
                <th style={{ padding: '8px 10px' }}>Actor ID</th>
                <th style={{ padding: '8px 10px' }}>Action</th>
                <th style={{ padding: '8px 10px' }}>Target Resource</th>
                <th style={{ padding: '8px 10px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#94a3b8' }}>User #{log.user_id || 'System'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', color: '#cbd5e1' }}>{log.resource}</td>
                  <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{log.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
