import React, { useState, useCallback } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { RiDownloadLine, RiFileTextLine, RiSearchLine } from 'react-icons/ri';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Statements() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    type: '', category_id: '',
  });

  const fetchCategories = useCallback(async () => {
    try { const res = await api.get('/categories'); setCategories(res.data); } catch {}
  }, []);

  useState(() => { fetchCategories(); }, []);

  const fetchStatement = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      const res = await api.get(`/statements?${params}`);
      setData(res.data);
    } catch { toast.error('Failed to generate statement'); }
    finally { setLoading(false); }
  };

  const downloadCSV = () => {
    if (!data) return;
    const header = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Currency', 'Tags', 'Notes'];
    const rows = data.transactions.map(tx => [
      formatDate(tx.date), tx.description || '',
      tx.category_name || '', tx.type,
      tx.amount, tx.currency || user?.currency,
      (typeof tx.tags === 'string' ? JSON.parse(tx.tags || '[]') : tx.tags || []).join('; '),
      tx.notes || '',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `statement_${filters.start_date}_${filters.end_date}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('CSV downloaded!');
  };

  const downloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF();

    // Header
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('Financial Statement', 20, 22);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`${formatDate(filters.start_date)} — ${formatDate(filters.end_date)}`, 20, 32);
    doc.text(user?.name || '', 210 - 20, 22, { align: 'right' });

    // Summary boxes
    doc.setTextColor(30, 41, 59);
    const summaryY = 55;
    const boxes = [
      { label: 'Total Income', value: formatCurrency(data.summary.income, user?.currency), color: [16, 185, 129] },
      { label: 'Total Expense', value: formatCurrency(data.summary.expense, user?.currency), color: [239, 68, 68] },
      { label: 'Net Savings', value: formatCurrency(data.summary.savings, user?.currency), color: [99, 102, 241] },
      { label: 'Transactions', value: data.summary.count, color: [245, 158, 11] },
    ];
    boxes.forEach((box, i) => {
      const x = 14 + i * 46;
      doc.setFillColor(...box.color);
      doc.roundedRect(x, summaryY, 43, 22, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(box.label, x + 21.5, summaryY + 8, { align: 'center' });
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text(String(box.value), x + 21.5, summaryY + 17, { align: 'center' });
    });

    // Transactions table
    doc.autoTable({
      startY: summaryY + 32,
      head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
      body: data.transactions.map(tx => [
        formatDate(tx.date), tx.description || '—', tx.category_name || '—',
        tx.type.toUpperCase(), `${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount, tx.currency)}`,
      ]),
      headStyles: { fillColor: [99, 102, 241], textColor: 255 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          data.cell.styles.textColor = data.row.raw[3] === 'INCOME' ? [16, 185, 129] : [239, 68, 68];
        }
      },
    });

    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Generated on ${new Date().toLocaleString()} · FinTrack Money Manager`, 105, 290, { align: 'center' });

    doc.save(`statement_${filters.start_date}_${filters.end_date}.pdf`);
    toast.success('PDF downloaded!');
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Statements</h1>
        <p className="page-subtitle">Generate and export financial statements</p>
      </div>

      {/* Filter Panel */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Filter Transactions</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={filters.start_date}
              onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={filters.end_date}
              onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Type</label>
            <select className="form-select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Category</label>
            <select className="form-select" value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={fetchStatement} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><RiSearchLine size={16} /> Generate</>}
          </button>
        </div>
      </div>

      {/* Results */}
      {data && (
        <>
          {/* Summary */}
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[
              { label: 'Total Income', value: data.summary.income, color: 'var(--accent-green)' },
              { label: 'Total Expense', value: data.summary.expense, color: 'var(--accent-red)' },
              { label: 'Net Savings', value: data.summary.savings, color: 'var(--accent-blue)' },
              { label: 'Transactions', value: data.summary.count, mono: false },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>
                  {s.mono === false ? s.value : formatCurrency(s.value, user?.currency)}
                </div>
              </div>
            ))}
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="btn btn-success" onClick={downloadPDF}>
              <RiFileTextLine size={16} /> Export PDF
            </button>
            <button className="btn btn-outline" onClick={downloadCSV}>
              <RiDownloadLine size={16} /> Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0 }}>
            {data.transactions.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">📄</div><h3>No transactions found</h3></div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Description</th><th>Category</th><th>Type</th><th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(tx.date)}</td>
                        <td><div style={{ fontSize: 14 }}>{tx.description || '—'}</div></td>
                        <td style={{ fontSize: 13 }}>{tx.category_icon} {tx.category_name || '—'}</td>
                        <td><span className={`badge ${tx.type === 'income' ? 'badge-green' : 'badge-red'}`}>{tx.type}</span></td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: tx.type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency || user?.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700, padding: '12px 14px', borderTop: '2px solid var(--border-light)' }}>Net Balance</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 16, padding: '12px 14px', borderTop: '2px solid var(--border-light)', color: data.summary.savings >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {formatCurrency(data.summary.savings, user?.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
