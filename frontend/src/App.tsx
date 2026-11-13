import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { MarketplaceFarmer } from './components/MarketplaceFarmer';
import { MarketplaceWorker } from './components/MarketplaceWorker';
import { ProfitSimulatorScreen } from './components/ProfitSimulatorScreen';
import { FarmAiHub } from './components/FarmAiHub';
import { AdminPortal } from './components/AdminPortal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { AuthModal } from './components/AuthModal';
import { RoleSwitchModal } from './components/RoleSwitchModal';
import { QuickDemoBar } from './components/QuickDemoBar';
import { Language, getT } from './i18n';
import { User, Notification, Role } from './types';
import { api } from './api';
import { supabase } from './supabase';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<'marketplace' | 'simulator' | 'farmAi' | 'admin'>('marketplace');
  const [hybridSubTab, setHybridSubTab] = useState<'farmer' | 'worker'>('farmer');
  const [lang, setLang] = useState<Language>('en');

  const t = getT(lang);

  // Modals & Panels
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRoleSwitchModal, setShowRoleSwitchModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize user session from localStorage or active Supabase OAuth callback
  useEffect(() => {
    let isMounted = true;

    const syncSupabaseSession = async (session: any) => {
      if (!session?.user) return false;
      const email = session.user.email;
      if (!email) return false;

      const fullName =
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        email.split('@')[0];
      const phone = session.user.phone || session.user.user_metadata?.phone || null;
      const intentRole = (localStorage.getItem('agriconnect_oauth_intent_role') as Role) || 'HYBRID';

      try {
        const res = await api.auth.oauthSync({
          email,
          name: fullName,
          role: intentRole,
          phone,
          provider: 'google',
        });
        const userObj: User = {
          id: res.user_id,
          name: res.name,
          email: res.email || email,
          role: res.role,
          phone: res.phone || phone,
          token: res.token,
        };
        localStorage.setItem('agriconnect_token', res.token);
        localStorage.setItem('agriconnect_user', JSON.stringify(userObj));
        if (isMounted) {
          setCurrentUser(userObj);
          setShowAuthModal(false);
        }

        if (window.location.hash || window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        return true;
      } catch (err: any) {
        console.error('Failed to sync OAuth user:', err);
        return false;
      }
    };

    const initAuth = async () => {
      // 1. Check if URL contains an OAuth error from Google/Supabase
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const searchParams = new URLSearchParams(window.location.search);
      const urlError =
        hashParams.get('error_description') ||
        searchParams.get('error_description') ||
        hashParams.get('error');
      if (urlError) {
        console.warn('OAuth redirect error detected:', urlError);
        alert(`Google Sign-In notice: ${decodeURIComponent(urlError)}`);
        window.history.replaceState({}, document.title, window.location.pathname);
        if (isMounted) {
          setShowAuthModal(true);
        }
        return;
      }

      // 2. Check if we already have a saved user in localStorage
      const savedUserStr = localStorage.getItem('agriconnect_user');
      const savedToken = localStorage.getItem('agriconnect_token');
      if (savedUserStr && savedToken) {
        try {
          const parsed = JSON.parse(savedUserStr);
          if (isMounted) {
            setCurrentUser({ ...parsed, token: savedToken });
            setShowAuthModal(false);
          }
          return;
        } catch {
          localStorage.removeItem('agriconnect_user');
          localStorage.removeItem('agriconnect_token');
        }
      }

      // 3. Check if Supabase has an active session from an OAuth redirect
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const synced = await syncSupabaseSession(session);
          if (synced) return;
        }
      } catch (err) {
        console.warn('Supabase getSession check failed:', err);
      }

      // 4. If still not logged in, open Auth Modal
      if (isMounted) {
        setCurrentUser(null);
        setShowAuthModal(true);
      }
    };

    initAuth();

    // Listen for runtime auth state events (e.g. background sign-in or session changes)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        await syncSupabaseSession(session);
      }
    });

    const handleSessionExpired = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncSupabaseSession(session);
      } else {
        if (isMounted) {
          setCurrentUser(null);
          setShowAuthModal(true);
        }
      }
    };

    window.addEventListener('agriconnect_session_expired', handleSessionExpired);

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener('agriconnect_session_expired', handleSessionExpired);
    };
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const [list, unread] = await Promise.all([
        api.notifications.get(),
        api.notifications.getUnreadCount(),
      ]);
      setNotifications(list);
      setUnreadCount(unread.unread_count);
    } catch (e) {
      // not logged in
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const handleSelectUser = (u: any) => {
    const userPayload: User = {
      id: u.id || u.user_id,
      name: u.name,
      email: u.email || '',
      role: u.role,
      phone: u.phone,
      token: u.token,
    };
    setCurrentUser(userPayload);
    localStorage.setItem('agriconnect_token', u.token);
    localStorage.setItem('agriconnect_user', JSON.stringify(userPayload));
    // If admin is selected, switch to admin tab, otherwise stay or go to marketplace
    if (u.role === 'ADMIN') {
      setCurrentTab('admin');
    } else if (currentTab === 'admin') {
      setCurrentTab('marketplace');
    }
    fetchNotifications();
  };

  const handleLogout = () => {
    supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('agriconnect_token');
    localStorage.removeItem('agriconnect_user');
    setCurrentUser(null);
    setShowAuthModal(true);
  };

  const isDemoModeRequested =
    typeof window !== 'undefined' &&
    (window.location.search.includes('demo=true') || window.location.hash.includes('demo'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 1-Click Evaluation Persona Switcher: Only displayed if explicitly requested (?demo=true) */}
      {isDemoModeRequested && (
        <QuickDemoBar
          onSelectUser={handleSelectUser}
          onOpenAuth={() => setShowAuthModal(true)}
          currentUser={currentUser}
        />
      )}

      {/* Main Sticky Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        lang={lang}
        onSelectLang={setLang}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenRoleSwitch={() => setShowRoleSwitchModal(true)}
        onOpenNotifications={() => {
          setShowNotifications(true);
          fetchNotifications();
        }}
        unreadCount={unreadCount}
      />

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '1360px', width: '100%', margin: '0 auto', padding: '28px 24px' }}>
        {currentTab === 'marketplace' && (
          currentUser ? (
            currentUser.role === 'HYBRID' ? (
              <div>
                {/* Dual-Mode Switcher for Hybrid (Farmer + Worker) users */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    marginBottom: 24,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.4rem' }}>🔄</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.94rem' }}>
                        {t('dualModeTitle')}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>
                        {t('dualModeDesc')}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      background: 'rgba(15, 23, 42, 0.85)',
                      padding: '4px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <button
                      onClick={() => setHybridSubTab('farmer')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: hybridSubTab === 'farmer' ? '#22c55e' : 'transparent',
                        color: hybridSubTab === 'farmer' ? '#0f172a' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>👨‍🌾</span>
                      <span>{t('farmerOperationsTab')}</span>
                    </button>
                    <button
                      onClick={() => setHybridSubTab('worker')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: hybridSubTab === 'worker' ? '#3b82f6' : 'transparent',
                        color: hybridSubTab === 'worker' ? '#ffffff' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>👷</span>
                      <span>{t('workerMarketplaceTab')}</span>
                    </button>
                  </div>
                </div>

                {hybridSubTab === 'farmer' ? (
                  <MarketplaceFarmer key={`hybrid-farmer-${currentUser.id}-${currentUser.token}`} lang={lang} />
                ) : (
                  <MarketplaceWorker key={`hybrid-worker-${currentUser.id}-${currentUser.token}`} lang={lang} />
                )}
              </div>
            ) : currentUser.role === 'WORKER' ? (
              <MarketplaceWorker key={`worker-${currentUser.id}-${currentUser.token}`} lang={lang} />
            ) : (
              <MarketplaceFarmer key={`farmer-${currentUser.id}-${currentUser.token}`} lang={lang} />
            )
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 24px',
                maxWidth: '680px',
                margin: '40px auto',
                background: 'rgba(15, 23, 42, 0.75)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <span style={{ fontSize: '1.8rem' }}>🌾</span>
              </div>
              <h2 style={{ fontSize: '1.6rem', color: '#f8fafc', marginBottom: 8 }}>
                {t('welcomeMarketplace')}
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.94rem', marginBottom: 24, lineHeight: 1.5 }}>
                {t('welcomeMarketplaceDesc')}
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="btn-primary"
                style={{ padding: '12px 28px', fontSize: '0.98rem', fontWeight: 600 }}
              >
                {t('signInWithGoogle')}
              </button>
            </div>
          )
        )}

        {currentTab === 'simulator' && <ProfitSimulatorScreen lang={lang} />}

        {currentTab === 'farmAi' && <FarmAiHub lang={lang} />}

        {currentTab === 'admin' && <AdminPortal />}
      </main>

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onRefresh={fetchNotifications}
        lang={lang}
      />

      {/* Login & Register Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(u) => {
          handleSelectUser(u);
          setShowAuthModal(false);
        }}
      />

      {/* Role Switcher Modal (Farmer, Worker, Hybrid) */}
      <RoleSwitchModal
        isOpen={showRoleSwitchModal}
        onClose={() => setShowRoleSwitchModal(false)}
        currentUser={currentUser}
        lang={lang}
        onRoleUpdated={(updated) => {
          setCurrentUser(updated);
          if (updated.role === 'WORKER') {
            setHybridSubTab('worker');
          } else if (updated.role === 'FARMER') {
            setHybridSubTab('farmer');
          }
        }}
      />

      {/* Footer */}
      <footer
        style={{
          background: 'rgba(11, 19, 32, 0.95)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '24px',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.84rem',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong style={{ color: '#cbd5e1' }}>AgriConnect Platform</strong> — AI-Powered Agricultural Workforce & Farm Intelligence
          </div>
          <div>
            B.Tech Final-Year Project | Author: <strong style={{ color: '#cbd5e1' }}>Katta Guravaiah (23KB1A0597)</strong>
          </div>
          <div>
            FastAPI 0.110 + React 19 + PWA + SQLite/PostgreSQL
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
