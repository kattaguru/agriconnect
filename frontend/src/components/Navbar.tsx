import React from 'react';
import {
  Sprout,
  Bell,
  Globe,
  LogOut,
  User as UserIcon,
  Shield,
  Layers,
  Sparkles,
  Calculator,
} from 'lucide-react';
import { Language, translations } from '../i18n';
import { User } from '../types';

interface NavbarProps {
  currentTab: 'marketplace' | 'simulator' | 'farmAi' | 'admin';
  onSelectTab: (tab: 'marketplace' | 'simulator' | 'farmAi' | 'admin') => void;
  lang: Language;
  onSelectLang: (lang: Language) => void;
  currentUser: User | null;
  onLogout: () => void;
  onOpenNotifications: () => void;
  onOpenAuth: () => void;
  onOpenRoleSwitch?: () => void;
  unreadCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  lang,
  onSelectLang,
  currentUser,
  onLogout,
  onOpenNotifications,
  onOpenAuth,
  onOpenRoleSwitch,
  unreadCount,
}) => {
  const t = translations[lang];

  return (
    <header
      style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '0 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onSelectTab('marketplace')}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--primary-glow)',
            }}
          >
            <Sprout size={24} color="#fef08a" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', lineHeight: 1.1, color: '#f8fafc' }}>
              Agri<span style={{ color: '#4ade80' }}>Connect</span>
            </h1>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', letterSpacing: '0.03em' }}>
              Agricultural Workforce & Intelligence
            </span>
          </div>
        </div>

        {/* Central Navigation Tabs */}
        <nav style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => onSelectTab('marketplace')}
            className={`tab-btn ${currentTab === 'marketplace' ? 'active' : ''}`}
          >
            <Layers size={16} /> {t.marketplace}
          </button>

          <button
            onClick={() => onSelectTab('simulator')}
            className={`tab-btn ${currentTab === 'simulator' ? 'active' : ''}`}
          >
            <Calculator size={16} /> {t.simulator}
          </button>

          <button
            onClick={() => onSelectTab('farmAi')}
            className={`tab-btn ${currentTab === 'farmAi' ? 'active' : ''}`}
          >
            <Sparkles size={16} /> {t.farmAi}
          </button>

          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`tab-btn ${currentTab === 'admin' ? 'active' : ''}`}
            >
              <Shield size={16} /> {t.admin}
            </button>
          )}
        </nav>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Language Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={16} color="#94a3b8" />
            <select
              className="form-select"
              style={{
                padding: '6px 10px',
                fontSize: '0.84rem',
                width: 'auto',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
              }}
              value={lang}
              onChange={(e) => onSelectLang(e.target.value as Language)}
            >
              <option value="en">English (EN)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
          </div>

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            style={{
              position: 'relative',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#cbd5e1',
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile / Status */}
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>
                  {currentUser.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {currentUser.phone || currentUser.email}
                  </span>
                  <button
                    type="button"
                    onClick={onOpenRoleSwitch}
                    title="Click to switch role between Farmer, Worker, or Hybrid"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: onOpenRoleSwitch ? 'pointer' : 'default',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      className={`badge ${
                        currentUser.role === 'FARMER'
                          ? 'badge-green'
                          : currentUser.role === 'WORKER'
                          ? 'badge-amber'
                          : currentUser.role === 'HYBRID'
                          ? 'badge-purple'
                          : 'badge-blue'
                      }`}
                      style={{
                        fontSize: '0.65rem',
                        padding: '2px 8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                        ...(currentUser.role === 'HYBRID'
                          ? { background: 'linear-gradient(135deg, #059669 0%, #2563eb 100%)', color: '#ffffff', border: 'none' }
                          : {}),
                      }}
                    >
                      {currentUser.role === 'HYBRID'
                        ? '👨‍🌾👷 HYBRID (Farmer + Worker)'
                        : currentUser.role === 'FARMER'
                        ? '👨‍🌾 FARMER (Farmer Only)'
                        : currentUser.role === 'WORKER'
                        ? '👷 WORKER (Worker Only)'
                        : currentUser.role}
                      {currentUser.role !== 'ADMIN' && (
                        <span style={{ opacity: 0.75, fontSize: '0.62rem', marginLeft: 2 }}>⇄ Switch</span>
                      )}
                    </span>
                  </button>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="btn-secondary btn-sm"
                style={{ padding: '6px 10px', color: '#f87171' }}
                title="Log Out of My Space"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="btn-primary btn-sm"
              style={{ gap: 6, padding: '8px 14px', fontSize: '0.84rem' }}
            >
              <UserIcon size={15} />
              <span>Sign In / Join</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
