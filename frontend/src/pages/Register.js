import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { RiMoneyDollarCircleLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri';

export default function Register() {
  const { register, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [otpCode, setOtpCode] = useState('');
  const [otpChallenge, setOtpChallenge] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const getSetupText = () => {
    if (!otpChallenge?.otp_setup) return '';
    if (typeof otpChallenge.otp_setup === 'string') return otpChallenge.otp_setup;
    return otpChallenge.otp_setup.qr || otpChallenge.otp_setup.qrcode || otpChallenge.otp_setup.url || otpChallenge.otp_setup.otpauth_url || JSON.stringify(otpChallenge.otp_setup);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const result = await register(form);
      if (result.otp_required) {
        setOtpChallenge(result);
        toast.success('Account created. Set up OTP to continue.');
        return;
      }
      toast.success('Account created! Welcome to FinTrack 🎉');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyOtp(otpChallenge.pending_token, otpCode);
      toast.success('Account verified. Welcome to FinTrack');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-primary)', padding: 20,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', bottom: '10%', right: '20%',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 440 }} className="fade-in">
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, background: 'var(--gradient-1)',
            borderRadius: 14, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 28, marginBottom: 14,
            boxShadow: '0 8px 30px rgba(99,102,241,0.4)',
          }}>
            <RiMoneyDollarCircleLine color="white" />
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            Create Account
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Start managing your finances smartly
          </p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {otpChallenge ? (
            <form onSubmit={handleOtpSubmit}>
              <div className="form-group">
                <label className="form-label">Authenticator Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  placeholder="6 digit code"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, wordBreak: 'break-word' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Set up authenticator:</strong>
                <div style={{ marginTop: 8 }}>{getSetupText()}</div>
                {otpChallenge.manual_secret && <div style={{ marginTop: 8 }}>Manual secret: {otpChallenge.manual_secret}</div>}
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Verify Code'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => setOtpChallenge(null)}>
                Back to registration
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid-2" style={{ gap: 16, marginBottom: 0 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text" className="form-input" placeholder="John Doe"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone (Optional)</label>
                <input
                  type="tel" className="form-input" placeholder="+91 98765 43210"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email" className="form-input" placeholder="you@example.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} className="form-input"
                  placeholder="Min. 6 characters" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} required
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0,
                }}>
                  {showPass ? <RiEyeOffLine size={18} /> : <RiEyeLine size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit" className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}
            >
              {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Create Account'}
            </button>
          </form>
          )}

          {!otpChallenge && <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>}
        </div>
      </div>
    </div>
  );
}
