import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate, today } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import TransactionModal from '../components/transactions/TransactionModal';
import {
  RiAddLine, RiSearchLine, RiFilterLine, RiEditLine,
  RiDeleteBinLine, RiArrowUpLine, RiArrowDownLine, RiAttachmentLine
} from 'react-icons/ri';

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', category_id: '', start_date: '', end_date: '', search: '' });
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const fetchCategories = useCallback(async () => {
    try { const res = await api.get('/categories'); setCategories(res.data); } catch {}
  }, []);

  const fetchTransactions = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 15, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
      const res = await api.get(`/transactions?${params}`);
      setTransactions(res.data.transactions);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchTransactions(page); }, [fetchTransactions, page]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      toast.success('Transaction deleted');
      fetchTransactions(page);
    } catch { toast.error('Failed to delete'); }
  };

  const handleEdit = (tx) => { setEditTx(tx); setShowModal(true); };
  const handleAdd = () => { setEditTx(null); setShowModal(true); };

  const handleFilterChange = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }));
    setPage(1);
  };

  const clearFilters = () => { setFilters({ type: '', category_id: '', start_date: '', end_date: '', search: '' }); setPage(1); };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{pagination.total} total transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowFilters(!showFilters)}>
            <RiFilterLine size={16} /> Filters
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>
            <RiAddLine size={16} /> Add Transaction
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
            <RiSearchLine size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text" className="form-input" placeholder="Search transactions..."
              style={{ paddingLeft: 36 }} value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
            />
          </div>
          <select className="form-select" style={{ width: 130 }} value={filters.type} onChange={e => handleFilterChange('type', e.target.value)}>
            <option value="">All Types</option>
            <option value="income">💰 Income</option>
            <option value="expense">💸 Expense</option>
          </select>
          {showFilters && (
            <>
              <select className="form-select" style={{ width: 150 }} value={filters.category_id} onChange={e => handleFilterChange('category_id', e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <input type="date" className="form-input" style={{ width: 150 }} value={filters.start_date} onChange={e => handleFilterChange('start_date', e.target.value)} placeholder="From" />
              <input type="date" className="form-input" style={{ width: 150 }} value={filters.end_date} onChange={e => handleFilterChange('end_date', e.target.value)} placeholder="To" />
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner"></div></div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>No transactions found</h3>
            <p>Try adjusting your filters or add a new transaction.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleAdd}>
              <RiAddLine size={16} /> Add First Transaction
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Tags</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(tx.date)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {tx.receipt_url && <RiAttachmentLine size={14} color="var(--text-muted)" title="Has receipt" />}
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{tx.description || '—'}</div>
                          {tx.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{tx.notes.slice(0, 40)}{tx.notes.length > 40 ? '...' : ''}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 13 }}>
                        {tx.category_icon && <span style={{ marginRight: 4 }}>{tx.category_icon}</span>}
                        {tx.category_name || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${tx.type === 'income' ? 'badge-green' : 'badge-red'}`}>
                        {tx.type === 'income' ? <RiArrowUpLine size={10} /> : <RiArrowDownLine size={10} />}
                        {tx.type}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                        color: tx.type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)',
                      }}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency || user?.currency)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(typeof tx.tags === 'string' ? JSON.parse(tx.tags || '[]') : tx.tags || []).slice(0, 2).map(tag => (
                          <span key={tag} className="chip" style={{ fontSize: 10, padding: '2px 8px' }}>{tag}</span>
                        ))}
                        {tx.is_recurring && <span className="badge badge-blue" style={{ fontSize: 9 }}>🔄</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(tx)} title="Edit">
                          <RiEditLine size={15} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(tx.id)} title="Delete"
                          style={{ color: 'var(--accent-red)' }}>
                          <RiDeleteBinLine size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Page {page} of {pagination.pages}</span>
            <button className="btn btn-outline btn-sm" disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {showModal && (
        <TransactionModal
          transaction={editTx}
          defaultType={editTx?.type || 'expense'}
          onClose={() => { setShowModal(false); setEditTx(null); }}
          onSave={() => { setShowModal(false); setEditTx(null); fetchTransactions(page); }}
        />
      )}
    </div>
  );
}
