import React, { useState, useEffect, useCallback } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement, Tooltip, Legend, Filler
} from 'chart.js';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import { RiArrowUpLine, RiArrowDownLine, RiLineChartLine, RiLightbulbLine } from 'react-icons/ri';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler);

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
  },
};

export default function Analytics() {
  const { user } = useAuth();
  const [trend, setTrend] = useState([]);
  const [yearly, setYearly] = useState({ monthly: [], income: 0, expense: 0, savings: 0 });
  const [breakdown, setBreakdown] = useState({ expense: [], income: [] });
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth() + 1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, y, be, bi, ins] = await Promise.all([
        api.get('/analytics/monthly-trend'),
        api.get(`/analytics/yearly?year=${selectedYear}`),
        api.get(`/analytics/category-breakdown?type=expense&month=${activeMonth}&year=${selectedYear}`),
        api.get(`/analytics/category-breakdown?type=income&month=${activeMonth}&year=${selectedYear}`),
        api.get('/analytics/insights'),
      ]);
      setTrend(t.data);
      setYearly(y.data);
      setBreakdown({ expense: be.data, income: bi.data });
      setInsights(ins.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedYear, activeMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const trendBarData = {
    labels: trend.map(t => t.label),
    datasets: [
      { label: 'Income', data: trend.map(t => t.income), backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 6, borderSkipped: false },
      { label: 'Expense', data: trend.map(t => t.expense), backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 6, borderSkipped: false },
    ],
  };

  const savingsLineData = {
    labels: trend.map(t => t.label),
    datasets: [{
      label: 'Savings',
      data: trend.map(t => t.savings),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.08)',
      borderWidth: 2.5,
      pointBackgroundColor: '#6366f1',
      pointRadius: 4,
      tension: 0.4,
      fill: true,
    }],
  };

  const yearlyBarData = {
    labels: yearly.monthly?.map(m => m.label) || [],
    datasets: [
      { label: 'Income', data: yearly.monthly?.map(m => m.income) || [], backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 5, borderSkipped: false },
      { label: 'Expense', data: yearly.monthly?.map(m => m.expense) || [], backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 5, borderSkipped: false },
    ],
  };

  const makeDoughnut = (data) => ({
    labels: data.map(d => d.name || 'Other'),
    datasets: [{
      data: data.map(d => d.total),
      backgroundColor: data.map(d => d.color || '#6366f1'),
      borderWidth: 0, hoverOffset: 6,
    }],
  });

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  if (loading) return <div className="loading-center"><div className="spinner" style={{ width: 48, height: 48 }}></div></div>;

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Analytics & Insights</h1>
          <p className="page-subtitle">Understand your financial patterns</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-select" style={{ width: 100 }} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
          <select className="form-select" style={{ width: 120 }} value={activeMonth} onChange={e => setActiveMonth(Number(e.target.value))}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-3" style={{ marginBottom: 28 }}>
        {[
          { label: 'Annual Income', value: yearly.income, color: 'var(--accent-green)', icon: RiArrowUpLine },
          { label: 'Annual Expense', value: yearly.expense, color: 'var(--accent-red)', icon: RiArrowDownLine },
          { label: 'Net Savings', value: yearly.savings, color: yearly.savings >= 0 ? 'var(--accent-blue)' : 'var(--accent-red)', icon: RiLineChartLine },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="stat-card" style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', width: 48, height: 48, background: `${kpi.color}20`, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Icon size={24} color={kpi.color} />
              </div>
              <div className="stat-label">{kpi.label}</div>
              <div className="stat-value" style={{ color: kpi.color }}>{formatCurrency(kpi.value, user?.currency)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{selectedYear}</div>
            </div>
          );
        })}
      </div>

      {/* Trend Charts */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>12-Month Income vs Expense</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Monthly comparison</p>
          <div style={{ height: 240 }}>
            <Bar data={trendBarData} options={{
              ...CHART_OPTS,
              plugins: { legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 10, borderRadius: 3 } } },
            }} />
          </div>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Savings Trend</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Net savings over 12 months</p>
          <div style={{ height: 240 }}>
            <Line data={savingsLineData} options={{ ...CHART_OPTS, plugins: { legend: { display: false } } }} />
          </div>
        </div>
      </div>

      {/* Yearly Bar */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Yearly Overview — {selectedYear}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Month by month breakdown</p>
        <div style={{ height: 240 }}>
          <Bar data={yearlyBarData} options={{
            ...CHART_OPTS,
            plugins: { legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 10, borderRadius: 3 } } },
          }} />
        </div>
      </div>

      {/* Category Breakdowns */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {[{ title: 'Expense Categories', key: 'expense', color: 'var(--accent-red)' }, { title: 'Income Categories', key: 'income', color: 'var(--accent-green)' }].map(({ title, key, color }) => (
          <div key={key} className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{title} — {months[activeMonth - 1]}</h3>
            {breakdown[key].length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}><div className="empty-state-icon">📊</div><p>No data this month</p></div>
            ) : (
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ width: 150, height: 150, flexShrink: 0 }}>
                  <Doughnut data={makeDoughnut(breakdown[key])} options={{ plugins: { legend: { display: false } }, cutout: '68%', maintainAspectRatio: false, responsive: true }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {breakdown[key].map((cat, i) => {
                    const total = breakdown[key].reduce((s, c) => s + c.total, 0);
                    const pct = total > 0 ? ((cat.total / total) * 100).toFixed(1) : 0;
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{cat.icon} {cat.name}</span>
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatCurrency(cat.total, user?.currency)}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: cat.color, borderRadius: 4, transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* AI Insights */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <RiLightbulbLine size={20} color="var(--accent-amber)" />
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>AI-Powered Financial Insights</h3>
        </div>
        <div className="grid-2">
          {insights.map((ins, i) => (
            <div key={i} style={{
              padding: '16px 18px', borderRadius: 12,
              background: ins.type === 'alert' ? 'var(--accent-red-dim)' : ins.type === 'warning' ? 'var(--accent-amber-dim)' : ins.type === 'success' ? 'var(--accent-green-dim)' : 'var(--accent-blue-dim)',
              border: `1px solid ${ins.type === 'alert' ? 'rgba(239,68,68,0.2)' : ins.type === 'warning' ? 'rgba(245,158,11,0.2)' : ins.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'}`,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{ins.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ins.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
