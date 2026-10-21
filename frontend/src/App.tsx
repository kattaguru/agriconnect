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
import { Language } from './i18n';
import { User, Notification, Role } from './types';
import { api } from './api';
import { supabase } from './supabase';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<'marketplace' | 'simulator' | 'farmAi' | 'admin'>('marketplace');
  const [hybridSubTab, setHybridSubTab] = useState<'farmer' | 'worker'>('farmer');
  const [lang, setLang] = useState<Language>('en');

  // Modals & Panels
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRoleSwitchModal, setShowRoleSwitchModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize user session from localStorage ONLY (no hardcoded demo fallback)
  useEffect(() => {
    const initUser = async () => {
      try {
        const savedUserStr = localStorage.getItem('agriconnect_user');
        const savedToken = localStorage.getItem('agriconnect_token');
        if (savedUserStr && savedToken) {
          const parsed = JSON.parse(savedUserStr);
          setCurrentUser({ ...parsed, token: savedToken });
          return;
        }
        // No saved user -> clean state, open auth modal for live sign-in
        setCurrentUser(null);
        setShowAuthModal(true);
      } catch (err) {
        console.error('Initialization error:', err);
        setCurrentUser(null);
        setShowAuthModal(true);
      }
    };
    initUser();
  }, []);

  // Listen for Supabase OAuth callbacks (e.g. Google Sign-In redirect or page refresh)
  useEffect(() => {
    const syncSupabaseSession = async (session: any) => {
      if (!session?.user) return;
      const email = session.user.email;
      if (!email) return;

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
        setCurrentUser(userObj);
        setShowAuthModal(false);

        if (window.location.hash || window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (err) {
        console.error('Failed to sync OAuth user:', err);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await syncSupabaseSession(session);
      } else if (event === 'INITIAL_SESSION' && session?.user) {
        // If we have a Supabase user but no valid local backend token, sync now
        const savedToken = localStorage.getItem('agriconnect_token');
        if (!savedToken) {
          await syncSupabaseSession(session);
        }
      }
    });

    const handleSessionExpired = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncSupabaseSession(session);
      } else {
        setCurrentUser(null);
        setShowAuthModal(true);
      }
    };

    window.addEventListener('agriconnect_session_expired', handleSessionExpired);

    return () => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 1-Click Evaluation Persona Switcher */}
      <QuickDemoBar
        onSelectUser={handleSelectUser}
        onOpenAuth={() => setShowAuthModal(true)}
        currentUser={currentUser}
      />

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
                        Dual-Mode Workspace (Farmer & Worker)
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>
                        You have full privileges to both hire agricultural labor and apply for local farm work.
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
                      <span>Farmer Operations (My Farms & Jobs)</span>
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
                      <span>Worker Marketplace (Find Work & Apply)</span>
                    </button>
                  </div>
                </div>

                {hybridSubTab === 'farmer' ? (
                  <MarketplaceFarmer key={`hybrid-farmer-${currentUser.id}-${currentUser.token}`} />
                ) : (
                  <MarketplaceWorker key={`hybrid-worker-${currentUser.id}-${currentUser.token}`} />
                )}
              </div>
            ) : currentUser.role === 'WORKER' ? (
              <MarketplaceWorker key={`worker-${currentUser.id}-${currentUser.token}`} />
            ) : (
              <MarketplaceFarmer key={`farmer-${currentUser.id}-${currentUser.token}`} />
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
                Welcome to AgriConnect Marketplace
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.94rem', marginBottom: 24, lineHeight: 1.5 }}>
                Connect with verified farm workers or post agricultural labor requirements. Sign in with your Google account or 10-digit mobile number to enter your personal space.
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="btn-primary"
                style={{ padding: '12px 28px', fontSize: '0.98rem', fontWeight: 600 }}
              >
                Sign In with Google or Mobile
              </button>
            </div>
          )
        )}

        {currentTab === 'simulator' && <ProfitSimulatorScreen />}

        {currentTab === 'farmAi' && <FarmAiHub />}

        {currentTab === 'admin' && <AdminPortal />}
      </main>

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onRefresh={fetchNotifications}
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
