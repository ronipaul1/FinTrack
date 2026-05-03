import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { RiMoneyDollarCircleLine } from 'react-icons/ri';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSent(true);
      if (res.data.reset_token) setResetToken(res.data.reset_token);
      toast.success('Reset token generated (check dev console or use token below)');
    } catch {
      toast.error('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setResetting(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, password: newPassword });
      toast.success('Password reset! Please login.');
    } catch {
      toast.error('Invalid or expired token');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-primary)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }} className="fade-in">
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, background: 'var(--gradient-1)', borderRadius: 14,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 14, boxShadow: '0 8px 30px rgba(99,102,241,0.4)',
          }}>
            <RiMoneyDollarCircleLine color="white" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Reset Password</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
            Enter your email to receive a reset link
          </p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {!sent ? (
            <form onSubmit={handleRequest}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email" className="form-input" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              {resetToken && (
                <div style={{ padding: '10px 14px', background: 'var(--accent-blue-dim)', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Dev mode — Reset Token:</div>
                  <code style={{ color: 'var(--accent-blue)', wordBreak: 'break-all' }}>{resetToken}</code>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Reset Token</label>
                <input
                  type="text" className="form-input" placeholder="Paste token"
                  value={resetToken} onChange={e => setResetToken(e.target.value)} required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password" className="form-input" placeholder="Min. 6 characters"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={resetting}>
                {resetting ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Reset Password'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}>
            <Link to="/login" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>← Back to Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
