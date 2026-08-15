import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  RiDashboardLine, RiExchangeDollarLine, RiPieChartLine,
  RiFileTextLine, RiBookLine, RiFileListLine, RiBellLine,
  RiUserLine, RiLogoutBoxLine, RiMenuLine, RiCloseLine,
  RiSafe2Line
} from 'react-icons/ri';

const navItems = [
  { to: '/dashboard', icon: RiDashboardLine, label: 'Dashboard' },
  { to: '/transactions', icon: RiExchangeDollarLine, label: 'Transactions' },
  { to: '/savings', icon: RiSafe2Line, label: 'Savings & Investments' },
  { to: '/analytics', icon: RiPieChartLine, label: 'Analytics' },
  { to: '/invoices', icon: RiFileTextLine, label: 'Invoices' },
  { to: '/ledger', icon: RiBookLine, label: 'Account Book' },
  { to: '/statements', icon: RiFileListLine, label: 'Statements' },
  { to: '/reminders', icon: RiBellLine, label: 'Reminders' },
  { to: '/profile', icon: RiUserLine, label: 'Profile' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = () => (
    <div style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      position: 'fixed',
      top: 0, left: 0,
      zIndex: 100,
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 32 }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
    }}>
    <img
      src="/favicon.png"
      alt="FinTrack"
      style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    }}
  />
</div>
          
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>FinTrack</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Money Manager</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 8px', marginBottom: 8 }}>
          Main Menu
        </div>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              marginBottom: 4,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.15s',
              color: isActive ? 'white' : 'var(--text-secondary)',
              background: isActive ? 'var(--gradient-1)' : 'transparent',
              boxShadow: isActive ? '0 4px 15px rgba(99,102,241,0.3)' : 'none',
            })}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--gradient-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0,
            overflow: 'hidden',
          }}>
            {user?.profile_photo
              ? <img src={user.profile_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.currency || 'INR'}</div>
          </div>
        </div>
        <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogout}>
          <RiLogoutBoxLine size={16} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="sidebar-desktop" style={{ display: 'block' }}>
        <SidebarContent />
      </div>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: 'none',
          position: 'fixed', top: 16, left: 16,
          zIndex: 200,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 10,
          padding: '8px',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
        className="mobile-menu-btn"
      >
        {mobileOpen ? <RiCloseLine size={22} /> : <RiMenuLine size={22} />}
      </button>

      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99, backdropFilter: 'blur(4px)' }}
          />
          <SidebarContent />
        </>
      )}

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
