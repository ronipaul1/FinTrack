import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend
} from 'chart.js';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import {
  RiAddLine, RiArrowUpLine, RiArrowDownLine,
  RiWalletLine, RiSaveLine, RiLineChartLine,
  RiAlertLine, RiLightbulbLine, RiStickyNoteLine
} from 'react-icons/ri';
import TransactionModal from '../components/transactions/TransactionModal';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const chartDefaults = {
  plugins: { legend: { display: false } },
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState({ monthly_income: 0, monthly_expense: 0, monthly_savings: 0, total_balance: 0 });
  const [trend, setTrend] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [insights, setInsights] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [dashboardNotes, setDashboardNotes] = useState('');
  const [notesReady, setNotesReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('expense');
  const notesStorageKey = `dashboard-notes-${user?.id || user?.email || 'default'}`;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, b, tx, ins, rem] = await Promise.all([
        api.get('/transactions/summary'),
        api.get('/analytics/monthly-trend'),
        api.get('/analytics/category-breakdown?type=expense'),
        api.get('/transactions?limit=5'),
        api.get('/analytics/insights'),
        api.get('/reminders'),
      ]);
      setSummary(s.data);
      setTrend(t.data.slice(-6));
      setBreakdown(b.data.slice(0, 6));
      setRecentTx(tx.data.transactions || []);
      setInsights(ins.data);
      setReminders(rem.data.filter(r => !r.is_completed).slice(0, 3));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    setNotesReady(false);
    setDashboardNotes(localStorage.getItem(notesStorageKey) || '');
    setNotesReady(true);
  }, [notesStorageKey]);

  useEffect(() => {
    if (notesReady) localStorage.setItem(notesStorageKey, dashboardNotes);
  }, [dashboardNotes, notesReady, notesStorageKey]);

  const openAddModal = (type) => { setModalType(type); setShowModal(true); };

  const barData = {
    labels: trend.map(t => t.label),
    datasets: [
      { label: 'Income', data: trend.map(t => t.income), backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 6, borderSkipped: false },
      { label: 'Expense', data: trend.map(t => t.expense), backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 6, borderSkipped: false },
    ],
  };

  const doughnutData = {
    labels: breakdown.map(b => b.name || 'Other'),
    datasets: [{
      data: breakdown.map(b => b.total),
      backgroundColor: breakdown.map(b => b.color || '#6366f1'),
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };

  const statCards = [
    { label: 'Total Balance', value: summary.total_balance, color: 'var(--accent-blue)', icon: RiWalletLine, bg: 'var(--accent-blue-dim)' },
    { label: 'Monthly Income', value: summary.monthly_income, color: 'var(--accent-green)', icon: RiArrowUpLine, bg: 'var(--accent-green-dim)' },
    { label: 'Monthly Expense', value: summary.monthly_expense, color: 'var(--accent-red)', icon: RiArrowDownLine, bg: 'var(--accent-red-dim)' },
    { label: 'Monthly Savings', value: summary.monthly_savings, color: 'var(--accent-amber)', icon: RiSaveLine, bg: 'var(--accent-amber-dim)' },
  ];

  if (loading) return (
    <div className="loading-center">
      <div>
        <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 16px' }}></div>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading your dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's your financial overview for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-success btn-sm" onClick={() => openAddModal('income')}>
            <RiArrowUpLine size={16} /> Add Income
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => openAddModal('expense')}>
            <RiArrowDownLine size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-label">{card.label}</div>
                  <div className="stat-value" style={{ color: card.color }}>
                    {formatCurrency(card.value, user?.currency)}
                  </div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={card.color} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Income vs Expense</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Last 6 months trend</p>
            </div>
            <RiLineChartLine size={20} color="var(--accent-blue)" />
          </div>
          <div style={{ height: 220 }}>
            <Bar data={barData} options={{ ...chartDefaults, plugins: { legend: { display: true, labels: { color: '#94a3b8', font: { size: 12 }, boxWidth: 12, borderRadius: 4 } } } }} />
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Expense Breakdown</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>This month by category</p>
            </div>
          </div>
          {breakdown.length > 0 ? (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                <Doughnut data={doughnutData} options={{ plugins: { legend: { display: false } }, cutout: '70%', maintainAspectRatio: false, responsive: true }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {breakdown.map((cat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.icon} {cat.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{formatCurrency(cat.total, user?.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-icon">📊</div>
              <p>No expense data for this month</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        {/* Recent Transactions */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recent Transactions</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>View all →</button>
          </div>
          {recentTx.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <div className="empty-state-icon">💸</div>
              <p>No transactions yet</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => openAddModal('expense')}>
                <RiAddLine size={14} /> Add First Transaction
              </button>
            </div>
          ) : (
            recentTx.map((tx) => (
              <div key={tx.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: tx.type === 'income' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>
                  {tx.category_icon || (tx.type === 'income' ? '💰' : '💸')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.description || tx.category_name || 'Transaction'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(tx.date)} · {tx.category_name}</div>
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: tx.type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)',
                  flexShrink: 0,
                }}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, user?.currency)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* AI Insights + Reminders + Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Insights */}
          <div className="card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <RiLightbulbLine size={18} color="var(--accent-amber)" />
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>AI Insights</h3>
            </div>
            {insights.map((insight, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                background: insight.type === 'alert' ? 'var(--accent-red-dim)' :
                             insight.type === 'warning' ? 'var(--accent-amber-dim)' :
                             insight.type === 'success' ? 'var(--accent-green-dim)' : 'var(--accent-blue-dim)',
                borderRadius: 10, marginBottom: 8,
                borderLeft: `3px solid ${insight.type === 'alert' ? 'var(--accent-red)' :
                              insight.type === 'warning' ? 'var(--accent-amber)' :
                              insight.type === 'success' ? 'var(--accent-green)' : 'var(--accent-blue)'}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{insight.icon} {insight.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{insight.message}</div>
              </div>
            ))}
          </div>

          {/* Reminders */}
          {reminders.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RiAlertLine size={18} color="var(--accent-red)" />
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Upcoming Bills</h3>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reminders')}>View all</button>
              </div>
              {reminders.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(r.due_date)}</div>
                  </div>
                  {r.amount && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(r.amount, user?.currency)}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RiStickyNoteLine size={18} color="var(--accent-blue)" />
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Notes</h3>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Autosaved</span>
            </div>
            <textarea
              className="form-textarea"
              rows={4}
              maxLength={500}
              placeholder="Add quick notes, goals, or reminders..."
              value={dashboardNotes}
              onChange={e => setDashboardNotes(e.target.value)}
              style={{ minHeight: 110, resize: 'vertical' }}
            />
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
              {dashboardNotes.length}/500
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Add Income', icon: '💰', action: () => openAddModal('income'), color: 'var(--accent-green-dim)', border: 'var(--accent-green)' },
            { label: 'Add Expense', icon: '💸', action: () => openAddModal('expense'), color: 'var(--accent-red-dim)', border: 'var(--accent-red)' },
            { label: 'New Invoice', icon: '🧾', action: () => navigate('/invoices'), color: 'var(--accent-blue-dim)', border: 'var(--accent-blue)' },
            { label: 'Account Book', icon: '📒', action: () => navigate('/ledger'), color: 'var(--accent-amber-dim)', border: 'var(--accent-amber)' },
            { label: 'Analytics', icon: '📊', action: () => navigate('/analytics'), color: 'rgba(139,92,246,0.15)', border: 'var(--accent-purple)' },
            { label: 'Statements', icon: '📄', action: () => navigate('/statements'), color: 'rgba(20,184,166,0.15)', border: '#14b8a6' },
          ].map((item, i) => (
            <button key={i} onClick={item.action} style={{
              padding: '12px 20px', borderRadius: 12, cursor: 'pointer',
              background: item.color, border: `1px solid ${item.border}20`,
              color: 'var(--text-primary)', fontFamily: 'var(--font-main)',
              fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
      </div>

      {showModal && (
        <TransactionModal
          defaultType={modalType}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll(); }}
        />
      )}
    </div>
  );
}
