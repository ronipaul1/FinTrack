import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { RiUserLine, RiLockLine, RiCameraLine, RiSaveLine, RiShieldLine, RiGlobalLine } from 'react-icons/ri';

const CURRENCIES = [
  { code: 'INR', label: '₹ Indian Rupee' },
  { code: 'USD', label: '$ US Dollar' },
  { code: 'EUR', label: '€ Euro' },
  { code: 'GBP', label: '£ British Pound' },
  { code: 'JPY', label: '¥ Japanese Yen' },
  { code: 'AED', label: 'AED UAE Dirham' },
  { code: 'SGD', label: 'SGD Singapore Dollar' },
];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', currency: 'INR' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name || '', email: user.email || '', phone: user.phone || '', currency: user.currency || 'INR' });
    }
  }, [user]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put('/profile', { name: profile.name, phone: profile.phone, currency: profile.currency });
      updateUser(res.data);
      toast.success('Profile updated!');
    } catch { toast.error('Failed to update profile'); }
    finally { setLoading(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) { toast.error('Passwords do not match'); return; }
    if (passwords.new_password.length < 6) { toast.error('Password must be 6+ characters'); return; }
    setPwLoading(true);
    try {
      await api.put('/profile/change-password', { current_password: passwords.current_password, new_password: passwords.new_password });
      toast.success('Password changed successfully!');
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to change password'); }
    finally { setPwLoading(false); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    setPhotoLoading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.post('/profile/photo', fd);
      updateUser({ profile_photo: res.data.profile_photo });
      toast.success('Profile photo updated!');
    } catch { toast.error('Failed to upload photo'); }
    finally { setPhotoLoading(false); }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: RiUserLine },
    { id: 'security', label: 'Security', icon: RiShieldLine },
    { id: 'preferences', label: 'Preferences', icon: RiGlobalLine },
  ];

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Profile Settings</h1>
        <p className="page-subtitle">Manage your account and preferences</p>
      </div>

      {/* Avatar section */}
      <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: 'var(--gradient-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, fontWeight: 700, color: 'white',
            overflow: 'hidden', border: '3px solid var(--border-light)',
            boxShadow: '0 0 0 4px rgba(99,102,241,0.15)',
          }}>
            {user?.profile_photo
              ? <img src={user.profile_photo} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : user?.name?.[0]?.toUpperCase()}
          </div>
          <label htmlFor="photo-upload" style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--gradient-1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: '2px solid var(--bg-card)',
          }}>
            {photoLoading ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> : <RiCameraLine size={14} color="white" />}
          </label>
          <input id="photo-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{user?.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{user?.email}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span className="chip">💱 {user?.currency || 'INR'}</span>
            <span className="chip">📅 Joined {new Date(user?.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
            borderRadius: 9, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s',
            background: activeTab === id ? 'var(--gradient-1)' : 'transparent',
            color: activeTab === id ? 'white' : 'var(--text-secondary)',
            boxShadow: activeTab === id ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
          }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <RiUserLine size={20} color="var(--accent-blue)" />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Personal Information</h3>
          </div>
          <form onSubmit={handleProfileSave}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={profile.name}
                onChange={e => setProfile(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" value={profile.email} disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Email cannot be changed</p>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" placeholder="+91 98765 43210" value={profile.phone}
                onChange={e => setProfile(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><RiSaveLine size={16} /> Save Changes</>}
            </button>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <RiLockLine size={20} color="var(--accent-amber)" />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Change Password</h3>
          </div>
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-input" placeholder="Enter current password"
                value={passwords.current_password} onChange={e => setPasswords(f => ({ ...f, current_password: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-input" placeholder="Min. 6 characters"
                value={passwords.new_password} onChange={e => setPasswords(f => ({ ...f, new_password: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input type="password" className="form-input" placeholder="Confirm new password"
                value={passwords.confirm_password} onChange={e => setPasswords(f => ({ ...f, confirm_password: e.target.value }))} required />
              {passwords.new_password && passwords.confirm_password && passwords.new_password !== passwords.confirm_password && (
                <p style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 4 }}>⚠ Passwords do not match</p>
              )}
            </div>

            {/* Password strength */}
            {passwords.new_password && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  {[1,2,3,4].map(i => {
                    const strength = Math.min(4, Math.floor(passwords.new_password.length / 3) + (passwords.new_password.match(/[A-Z]/) ? 1 : 0) + (passwords.new_password.match(/[0-9]/) ? 1 : 0) + (passwords.new_password.match(/[^A-Za-z0-9]/) ? 1 : 0));
                    const active = i <= strength;
                    return <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: active ? (strength <= 1 ? 'var(--accent-red)' : strength <= 2 ? 'var(--accent-amber)' : strength <= 3 ? 'var(--accent-blue)' : 'var(--accent-green)') : 'var(--border-light)', transition: 'all 0.3s' }} />;
                  })}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {passwords.new_password.length < 6 ? 'Too short' : passwords.new_password.length < 9 ? 'Weak' : passwords.new_password.length < 12 ? 'Medium' : 'Strong'}
                </span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={pwLoading}>
              {pwLoading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><RiLockLine size={16} /> Change Password</>}
            </button>
          </form>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <RiGlobalLine size={20} color="var(--accent-green)" />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Preferences</h3>
          </div>
          <form onSubmit={handleProfileSave}>
            <div className="form-group">
              <label className="form-label">Default Currency</label>
              <select className="form-select" value={profile.currency}
                onChange={e => setProfile(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Used as default across all transactions and reports</p>
            </div>

            <div style={{ padding: '16px 20px', background: 'var(--bg-input)', borderRadius: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>🌙 Dark Mode</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Currently always on (dark theme)</div>
                </div>
                <span className="badge badge-green">Active</span>
              </div>
            </div>

            <div style={{ padding: '16px 20px', background: 'var(--bg-input)', borderRadius: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>📊 AI Insights</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Smart financial suggestions</div>
                </div>
                <span className="badge badge-green">Enabled</span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><RiSaveLine size={16} /> Save Preferences</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
