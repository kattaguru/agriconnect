import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Lock,
  Mail,
  Phone,
  ArrowRight,
  ShieldCheck,
  Sprout,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api';
import { Role } from '../types';
import { supabase } from '../supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: {
    token: string;
    user_id: number;
    name: string;
    role: string;
    email?: string;
    phone?: string;
  }) => void;
}

type AuthTab = 'phone_otp' | 'email_password' | 'register';

// Crisp official Google 'G' icon
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState<AuthTab>('phone_otp');

  // Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [isExistingPhoneUser, setIsExistingPhoneUser] = useState<boolean | null>(null);
  const [phoneUserName, setPhoneUserName] = useState('');
  const [phoneUserRole, setPhoneUserRole] = useState<Role>('FARMER');
  const [countdown, setCountdown] = useState(0);

  // Email/Password state
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('FARMER');

  // General state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  const [googleFallback, setGoogleFallback] = useState(false);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!isOpen) return null;

  // 1. Google OAuth Flow
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    setInfoNotice('');

    try {
      localStorage.setItem('agriconnect_oauth_intent_role', role);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (oauthError) {
        console.warn('Supabase Google OAuth status:', oauthError.message);
        setError(
          `Google Provider: ${oauthError.message}. You can enable Google Auth in your Supabase Dashboard or test with the 1-Click Google Account below.`
        );
        setGoogleFallback(true);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(err.message || 'Google authentication could not be completed.');
      setGoogleFallback(true);
    } finally {
      setGoogleLoading(false);
    }
  };

  // 1b. Google Demo Instant Sync (for local dev / viva evaluation)
  const handleDemoGoogleSignIn = async (roleOverride?: Role) => {
    setGoogleLoading(true);
    setError('');
    try {
      const chosenRole = roleOverride || role || 'HYBRID';
      const res = await api.auth.oauthSync({
        email: 'ramesh.farmer.google@agriconnect.org',
        name: 'Ramesh Patel (Google)',
        role: chosenRole,
        provider: 'google',
      });
      localStorage.setItem('agriconnect_token', res.token);
      localStorage.setItem('agriconnect_user', JSON.stringify(res));
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google account demo sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // 2. Phone OTP: Send Code
  const handleSendOtp = async (overridePhone?: string) => {
    const raw = overridePhone !== undefined ? overridePhone : phoneNumber;
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError('');
    setInfoNotice('');

    try {
      const res = await api.auth.sendPhoneOtp({ phone: digits });
      setOtpSent(true);
      setDemoOtp(res.demo_otp || '123456');
      setIsExistingPhoneUser(res.is_existing_user);
      setCountdown(30);
      setInfoNotice(
        `Verification code sent to +91 ${res.phone}! Please enter the 6-digit code below.`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please check the number.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Phone OTP: Verify Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!otpCode.trim()) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.auth.verifyPhoneOtp({
        phone: digits,
        otp: otpCode.trim(),
        name: phoneUserName.trim() || undefined,
        role: phoneUserRole,
      });

      localStorage.setItem('agriconnect_token', res.token);
      localStorage.setItem('agriconnect_user', JSON.stringify(res));
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Traditional Email & Password Form Submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (tab === 'register') {
        if (!email.trim() || !phone.trim()) {
          throw new Error('Both email address and 10-digit mobile number are required for registration.');
        }
        const res = await api.auth.register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          phone: phone.trim(),
        });
        localStorage.setItem('agriconnect_token', res.token);
        localStorage.setItem('agriconnect_user', JSON.stringify(res));
        onSuccess(res);
      } else {
        const idTrimmed = identifier.trim();
        if (!idTrimmed) {
          throw new Error('Please enter your email or 10-digit mobile number.');
        }
        const res = await api.auth.login({
          identifier: idTrimmed,
          password,
        });
        localStorage.setItem('agriconnect_token', res.token);
        localStorage.setItem('agriconnect_user', JSON.stringify(res));
        onSuccess(res);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        style={{
          maxWidth: '480px',
          width: '92%',
          padding: '28px 24px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #131f33 0%, #0c1524 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 6,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Close"
        >
          <X size={20} />
        </button>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, rgba(34, 197, 94, 0.05) 70%)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
            }}
          >
            <Sprout size={28} color="#22c55e" />
          </div>
          <h3 style={{ fontSize: '1.42rem', color: '#f8fafc', fontWeight: 700, margin: 0 }}>
            {tab === 'register' ? 'Create AgriConnect Account' : 'Welcome to AgriConnect'}
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 4, marginBottom: 0 }}>
            AI-Powered Workforce & Smart Agricultural Intelligence
          </p>
        </div>

        {/* ======================================================== */}
        {/* 1. GOOGLE LOGIN BUTTON                                    */}
        {/* ======================================================== */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>
              Join / Sign in as:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setRole('FARMER')}
                style={{
                  padding: '6px 4px',
                  borderRadius: '6px',
                  background: role === 'FARMER' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: role === 'FARMER' ? '2px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: role === 'FARMER' ? '#4ade80' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <span>👨‍🌾</span> <span>Farmer</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('WORKER')}
                style={{
                  padding: '6px 4px',
                  borderRadius: '6px',
                  background: role === 'WORKER' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: role === 'WORKER' ? '2px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: role === 'WORKER' ? '#4ade80' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <span>👷</span> <span>Worker</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('HYBRID')}
                style={{
                  padding: '6px 4px',
                  borderRadius: '6px',
                  background: role === 'HYBRID' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: role === 'HYBRID' ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: role === 'HYBRID' ? '#60a5fa' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <span>🔄</span> <span>Hybrid (Both)</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '12px 16px',
              backgroundColor: '#ffffff',
              color: '#1f2937',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              fontWeight: 600,
              fontSize: '0.94rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            <GoogleIcon size={20} />
            <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>
        </div>

        {/* OR Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            textAlign: 'center',
            margin: '16px 0',
            color: '#64748b',
            fontSize: '0.76rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <span style={{ padding: '0 12px' }}>Or continue with</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            background: 'rgba(15, 23, 42, 0.65)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab('phone_otp');
              setError('');
              setInfoNotice('');
            }}
            style={{
              padding: '8px 6px',
              borderRadius: '7px',
              border: 'none',
              background: tab === 'phone_otp' ? '#22c55e' : 'transparent',
              color: tab === 'phone_otp' ? '#0f172a' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s ease',
            }}
          >
            <Phone size={14} />
            <span>Mobile OTP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('email_password');
              setError('');
              setInfoNotice('');
            }}
            style={{
              padding: '8px 6px',
              borderRadius: '7px',
              border: 'none',
              background: tab === 'email_password' ? '#22c55e' : 'transparent',
              color: tab === 'email_password' ? '#0f172a' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s ease',
            }}
          >
            <Lock size={14} />
            <span>Password</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError('');
              setInfoNotice('');
            }}
            style={{
              padding: '8px 6px',
              borderRadius: '7px',
              border: 'none',
              background: tab === 'register' ? '#22c55e' : 'transparent',
              color: tab === 'register' ? '#0f172a' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s ease',
            }}
          >
            <User size={14} />
            <span>Register</span>
          </button>
        </div>

        {/* Notifications / Alerts */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 14,
              fontSize: '0.83rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        {infoNotice && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid #22c55e',
              color: '#86efac',
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 14,
              fontSize: '0.83rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>{infoNotice}</div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. PHONE NUMBER LOGIN (FAST OTP)                          */}
        {/* ======================================================== */}
        {tab === 'phone_otp' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Mobile Number Input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.84rem' }}>
                10-Digit Mobile Number
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    color: '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  required
                  className="form-input"
                  style={{ paddingLeft: 64, fontSize: '0.96rem', letterSpacing: '0.04em' }}
                  placeholder="98765 43210"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (otpSent) setOtpSent(false);
                  }}
                  maxLength={14}
                />
              </div>

              <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 6, display: 'block' }}>
                Enter your 10-digit mobile number to receive a secure SMS verification code.
              </span>
            </div>

            {/* Step 1: Send OTP Button (if not yet sent) */}
            {!otpSent ? (
              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={loading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading ? <RefreshCw className="spin" size={18} /> : <KeyRound size={18} />}
                <span>{loading ? 'Sending Code...' : 'Get Verification Code (OTP)'}</span>
              </button>
            ) : (
              <>
                {/* Step 2: OTP Verification Input */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ marginBottom: 6, fontSize: '0.84rem' }}>
                    Enter 6-Digit OTP Code
                  </label>

                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                    <input
                      type="text"
                      required
                      autoFocus
                      maxLength={6}
                      className="form-input"
                      style={{
                        paddingLeft: 38,
                        fontSize: '1.15rem',
                        letterSpacing: '0.25em',
                        fontWeight: 700,
                        textAlign: 'center',
                      }}
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                {/* If new phone number detected, prompt for name and role */}
                {isExistingPhoneUser === false && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px dashed rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginBottom: 8, fontWeight: 600 }}>
                      ✨ New Mobile Number Detected — Set up your quick profile:
                    </div>

                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label" style={{ fontSize: '0.76rem' }}>
                        Your Full Name
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Anand Rao"
                        value={phoneUserName}
                        onChange={(e) => setPhoneUserName(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem' }}>
                        I am a:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setPhoneUserRole('FARMER')}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '6px',
                            background: phoneUserRole === 'FARMER' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: phoneUserRole === 'FARMER' ? '2px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
                            color: phoneUserRole === 'FARMER' ? '#4ade80' : '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <span>👨‍🌾</span>
                          <span>Only Farmer</span>
                          <span style={{ fontSize: '0.64rem', color: '#64748b' }}>Post jobs</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPhoneUserRole('WORKER')}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '6px',
                            background: phoneUserRole === 'WORKER' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: phoneUserRole === 'WORKER' ? '2px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
                            color: phoneUserRole === 'WORKER' ? '#4ade80' : '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <span>👷</span>
                          <span>Only Worker</span>
                          <span style={{ fontSize: '0.64rem', color: '#64748b' }}>Find work</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPhoneUserRole('HYBRID')}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '6px',
                            background: phoneUserRole === 'HYBRID' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                            border: phoneUserRole === 'HYBRID' ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                            color: phoneUserRole === 'HYBRID' ? '#60a5fa' : '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <span>🔄</span>
                          <span>Both (Hybrid)</span>
                          <span style={{ fontSize: '0.64rem', color: '#60a5fa' }}>Farmer + Worker</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontWeight: 600,
                    fontSize: '0.94rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {loading ? <RefreshCw className="spin" size={18} /> : <ShieldCheck size={18} />}
                  <span>{loading ? 'Verifying...' : 'Verify OTP & Enter AgriConnect'}</span>
                </button>

                {/* Resend Link */}
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                  {countdown > 0 ? (
                    <span>Resend code in {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#22c55e',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Resend Verification Code
                    </button>
                  )}
                </div>
              </>
            )}
          </form>
        )}

        {/* ======================================================== */}
        {/* 3. EMAIL / PASSWORD & REGISTER TABS                      */}
        {/* ======================================================== */}
        {(tab === 'email_password' || tab === 'register') && (
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab === 'register' && (
              <>
                {/* Full Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.84rem' }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ paddingLeft: 38 }}
                      placeholder="e.g. Ramesh Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.84rem' }}>
                    I am joining as:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setRole('FARMER')}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 'var(--radius-md)',
                        background: role === 'FARMER' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: role === 'FARMER' ? '2px solid #22c55e' : '1px solid var(--border-subtle)',
                        color: role === 'FARMER' ? '#4ade80' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>👨‍🌾</span>
                      <span style={{ fontSize: '0.82rem' }}>Only Farmer</span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Post jobs & farms</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('WORKER')}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 'var(--radius-md)',
                        background: role === 'WORKER' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: role === 'WORKER' ? '2px solid #22c55e' : '1px solid var(--border-subtle)',
                        color: role === 'WORKER' ? '#4ade80' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>👷</span>
                      <span style={{ fontSize: '0.82rem' }}>Only Worker</span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Find paid work</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('HYBRID')}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 'var(--radius-md)',
                        background: role === 'HYBRID' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        border: role === 'HYBRID' ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                        color: role === 'HYBRID' ? '#60a5fa' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>🔄</span>
                      <span style={{ fontSize: '0.82rem' }}>Both (Hybrid)</span>
                      <span style={{ fontSize: '0.68rem', color: '#60a5fa' }}>Farmer + Worker</span>
                    </button>
                  </div>
                </div>

                {/* Email Address */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.84rem' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                    <input
                      type="email"
                      required
                      className="form-input"
                      style={{ paddingLeft: 38 }}
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.84rem' }}>
                    Mobile Number (10 digits)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                    <input
                      type="tel"
                      required
                      className="form-input"
                      style={{ paddingLeft: 38 }}
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {tab === 'email_password' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.84rem' }}>
                  Email Address or Mobile Number
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ paddingLeft: 38 }}
                    placeholder="e.g. ravi@example.com or 9440123456"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.84rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
                <input
                  type="password"
                  required
                  minLength={tab === 'register' ? 8 : 1}
                  maxLength={64}
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', marginTop: 4, padding: '12px', fontWeight: 600 }}
              disabled={loading}
            >
              {loading ? (
                'Authenticating...'
              ) : tab === 'register' ? (
                'Register & Enter My Space'
              ) : (
                'Sign In to My Space'
              )}
            </button>
          </form>
        )}

        {/* Footer Help text */}
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.82rem', color: '#94a3b8' }}>
          {tab === 'register' ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setTab('phone_otp');
                  setError('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#22c55e',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Sign In with Phone OTP
              </button>
            </>
          ) : (
            <>
              New to AgriConnect?{' '}
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#22c55e',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Create an Account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
