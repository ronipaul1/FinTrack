import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import {
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiCloseLine,
  RiDownloadLine
} from 'react-icons/ri';

const TYPES = [
  { value: 'fd', label: 'Fixed Deposit', icon: '🏦' },
  { value: 'stock', label: 'Stocks', icon: '📈' },
  { value: 'mutual_fund', label: 'Mutual Fund', icon: '📊' },
  { value: 'gold', label: 'Gold', icon: '🥇' },
  { value: 'silver', label: 'Silver', icon: '🥈' },
  { value: 'ppf', label: 'PPF', icon: '💰' },
  { value: 'bond', label: 'Bond', icon: '📜' },
  { value: 'crypto', label: 'Crypto', icon: '₿' },
  { value: 'other', label: 'Other', icon: '💎' }
];

const emptyForm = {
  type: 'fd',
  name: '',
  amount: '',
  current_value: '',
  booked_date: '',
  maturity_date: '',
  provider: '',
  platform: '',
  custom_message: '',
  receipt: null
};

export default function Savings() {
  const [investments, setInvestments] = useState([]);
  const [summary, setSummary] = useState({
    total_investments: 0,
    total_invested: 0,
    current_value: 0,
    withdrawn_value: 0
  });

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchSavings = async () => {
    try {
      setLoading(true);

      const [investmentsRes, summaryRes] = await Promise.all([
        api.get('/savings'),
        api.get('/savings/summary')
      ]);

      setInvestments(investmentsRes.data || []);
      setSummary(summaryRes.data || {});
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.error ||
        'Failed to load savings'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavings();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      booked_date: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const openEditModal = (investment) => {
    setEditingId(investment.id);

    setForm({
      type: investment.type || 'fd',
      name: investment.name || '',
      amount: investment.amount || '',
      current_value: investment.current_value || '',
      booked_date: investment.booked_date
        ? investment.booked_date.substring(0, 10)
        : '',
      maturity_date: investment.maturity_date
        ? investment.maturity_date.substring(0, 10)
        : '',
      provider: investment.provider || '',
      platform: investment.platform || '',
      custom_message: investment.custom_message || '',
      receipt: null
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Please enter an investment name');
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!form.booked_date) {
      toast.error('Please select the booked date');
      return;
    }

    try {
      setSaving(true);

      const data = new FormData();

      data.append('type', form.type);
      data.append('name', form.name);
      data.append('amount', form.amount);
      data.append('booked_date', form.booked_date);

      if (form.current_value !== '') {
        data.append(
          'current_value',
          form.current_value
        );
      }

      if (form.maturity_date) {
        data.append(
          'maturity_date',
          form.maturity_date
        );
      }

      if (form.provider) {
        data.append('provider', form.provider);
      }

      if (form.platform) {
        data.append('platform', form.platform);
      }

      if (form.custom_message) {
        data.append(
          'custom_message',
          form.custom_message
        );
      }

      if (form.receipt) {
        data.append('receipt', form.receipt);
      }

      if (editingId) {
        await api.put(
          `/savings/${editingId}`,
          data,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        toast.success(
          'Investment updated successfully'
        );
      } else {
        await api.post(
          '/savings',
          data,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        toast.success(
          'Investment added successfully'
        );
      }

      closeModal();
      await fetchSavings();

    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.error ||
        'Failed to save investment'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async (investment) => {
    const amount = window.prompt(
      'Enter withdrawn amount:',
      investment.current_value ||
      investment.amount
    );

    if (!amount) return;

    if (Number(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const date = window.prompt(
      'Enter withdrawal date (YYYY-MM-DD):',
      new Date().toISOString().split('T')[0]
    );

    if (!date) return;

    try {
      await api.post(
        `/savings/${investment.id}/withdraw`,
        {
          withdrawn_date: date,
          withdrawn_amount: Number(amount)
        }
      );

      toast.success(
        'Investment marked as withdrawn'
      );

      fetchSavings();

    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.error ||
        'Failed to withdraw investment'
      );
    }
  };

  const handleMature = async (investment) => {
    if (
      !window.confirm(
        `Mark "${investment.name}" as matured?`
      )
    ) {
      return;
    }

    try {
      await api.post(
        `/savings/${investment.id}/mature`
      );

      toast.success(
        'Investment marked as matured'
      );

      fetchSavings();

    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.error ||
        'Failed to update investment'
      );
    }
  };

  const handleDelete = async (investment) => {
    if (
      !window.confirm(
        `Delete "${investment.name}" permanently?`
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/savings/${investment.id}`
      );

      toast.success(
        'Investment deleted'
      );

      fetchSavings();

    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.error ||
        'Failed to delete investment'
      );
    }
  };

  const getType = (type) =>
    TYPES.find(t => t.value === type) || TYPES[8];

  const getStatusClass = (status) => {
    if (status === 'active') return 'success';
    if (status === 'matured') return 'warning';
    return 'danger';
  };

  if (loading) {
    return (
      <div className="loading-center">
        <div>
          <div
            className="spinner"
            style={{
              width: 48,
              height: 48,
              margin: '0 auto 16px'
            }}
          />
          <p
            style={{
              color: 'var(--text-secondary)',
              textAlign: 'center'
            }}
          >
            Loading your investments...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">

      {/* HEADER */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h1 className="page-title">
            Savings & Investments
          </h1>

          <p className="page-subtitle">
            Track your FD, stocks, gold, mutual funds
            and other investments separately from
            your transactions.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openAddModal}
        >
          <RiAddLine size={18} />
          Add Investment
        </button>
      </div>

      {/* SUMMARY */}
      <div
        className="grid-4"
        style={{ marginBottom: 28 }}
      >

        <div className="stat-card">
          <div className="stat-label">
            Total Investments
          </div>

          <div className="stat-value">
            {summary.total_investments || 0}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            Total Invested
          </div>

          <div
            className="stat-value"
            style={{
              color: 'var(--accent-blue)'
            }}
          >
            {formatCurrency(
              summary.total_invested || 0
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            Current Value
          </div>

          <div
            className="stat-value"
            style={{
              color: 'var(--accent-green)'
            }}
          >
            {formatCurrency(
              summary.current_value || 0
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            Withdrawn
          </div>

          <div
            className="stat-value"
            style={{
              color: 'var(--accent-amber)'
            }}
          >
            {formatCurrency(
              summary.withdrawn_value || 0
            )}
          </div>
        </div>

      </div>

      {/* INVESTMENTS */}
      <div className="card">

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700
              }}
            >
              My Investments
            </h3>

            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 3
              }}
            >
              Your savings and investments
            </p>
          </div>
        </div>

        {investments.length === 0 ? (

          <div
            className="empty-state"
            style={{ padding: 60 }}
          >
            <div className="empty-state-icon">
              💰
            </div>

            <h3>No investments yet</h3>

            <p>
              Start tracking your FD, stocks,
              gold or other investments.
            </p>

            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={openAddModal}
            >
              <RiAddLine size={16} />
              Add Your First Investment
            </button>
          </div>

        ) : (

          <div
            style={{
              display: 'flex',
              flexDirection: 'column'
            }}
          >

            {investments.map(investment => {

              const type =
                getType(investment.type);

              return (
                <div
                  key={investment.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '16px 0',
                    borderBottom:
                      '1px solid var(--border)',
                    flexWrap: 'wrap'
                  }}
                >

                  {/* ICON */}
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background:
                        'var(--accent-blue-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 21,
                      flexShrink: 0
                    }}
                  >
                    {type.icon}
                  </div>

                  {/* NAME */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 170
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700
                      }}
                    >
                      {investment.name}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color:
                          'var(--text-muted)',
                        marginTop: 3
                      }}
                    >
                      {type.label}
                      {investment.provider
                        ? ` · ${investment.provider}`
                        : ''}
                      {investment.platform
                        ? ` · ${investment.platform}`
                        : ''}
                    </div>
                  </div>

                  {/* AMOUNT */}
                  <div
                    style={{
                      minWidth: 130
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color:
                          'var(--text-muted)'
                      }}
                    >
                      Invested
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily:
                          'var(--font-mono)'
                      }}
                    >
                      {formatCurrency(
                        investment.amount
                      )}
                    </div>
                  </div>

                  {/* CURRENT VALUE */}
                  <div
                    style={{
                      minWidth: 130
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color:
                          'var(--text-muted)'
                      }}
                    >
                      Current Value
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color:
                          'var(--accent-green)',
                        fontFamily:
                          'var(--font-mono)'
                      }}
                    >
                      {formatCurrency(
                        investment.current_value ??
                        investment.amount
                      )}
                    </div>
                  </div>

                  {/* DATE */}
                  <div
                    style={{
                      minWidth: 120
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color:
                          'var(--text-muted)'
                      }}
                    >
                      Booked
                    </div>

                    <div
                      style={{
                        fontSize: 12
                      }}
                    >
                      {formatDate(
                        investment.booked_date
                      )}
                    </div>
                  </div>

                  {/* STATUS */}
                  <span
                    className={`badge badge-${getStatusClass(
                      investment.status
                    )}`}
                  >
                    {investment.status}
                  </span>

                  {/* ACTIONS */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 5
                    }}
                  >

                    <button
                      className="btn btn-ghost btn-sm"
                      title="Edit"
                      onClick={() =>
                        openEditModal(
                          investment
                        )
                      }
                    >
                      <RiEditLine size={15} />
                    </button>

                    {investment.status !==
                      'withdrawn' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Withdraw"
                        onClick={() =>
                          handleWithdraw(
                            investment
                          )
                        }
                      >
                        <RiDownloadLine
                          size={15}
                        />
                      </button>
                    )}

                    {investment.status ===
                      'active' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Mark as Matured"
                        onClick={() =>
                          handleMature(
                            investment
                          )
                        }
                      >
                        ✓
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-sm"
                      title="Delete"
                      onClick={() =>
                        handleDelete(
                          investment
                        )
                      }
                    >
                      <RiDeleteBinLine
                        size={15}
                        color="var(--accent-red)"
                      />
                    </button>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >

          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 650,
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >

            {/* MODAL HEADER */}
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                marginBottom: 22
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700
                  }}
                >
                  {editingId
                    ? 'Edit Investment'
                    : 'Add Investment'}
                </h2>

                <p
                  style={{
                    fontSize: 12,
                    color:
                      'var(--text-muted)',
                    marginTop: 4
                  }}
                >
                  This will not affect your
                  general transactions.
                </p>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
              >
                <RiCloseLine size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
            >

              {/* TYPE */}
              <div className="form-group">
                <label className="form-label">
                  Investment Type
                </label>

                <select
                  className="form-input"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                >
                  {TYPES.map(type => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* NAME */}
              <div className="form-group">
                <label className="form-label">
                  Investment Name
                </label>

                <input
                  className="form-input"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder={
                    form.type === 'fd'
                      ? 'e.g. HDFC 1 Year FD'
                      : 'e.g. Reliance Industries'
                  }
                  required
                />
              </div>

              {/* AMOUNT */}
              <div
                className="grid-2"
              >

                <div className="form-group">
                  <label className="form-label">
                    Amount
                  </label>

                  <input
                    className="form-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="₹ 0.00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Current Value
                  </label>

                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    name="current_value"
                    value={
                      form.current_value
                    }
                    onChange={handleChange}
                    placeholder="Optional"
                  />
                </div>

              </div>

              {/* DATES */}
              <div
                className="grid-2"
              >

                <div className="form-group">
                  <label className="form-label">
                    Booked Date
                  </label>

                  <input
                    className="form-input"
                    type="date"
                    name="booked_date"
                    value={
                      form.booked_date
                    }
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Maturity Date
                  </label>

                  <input
                    className="form-input"
                    type="date"
                    name="maturity_date"
                    value={
                      form.maturity_date
                    }
                    onChange={handleChange}
                  />
                </div>

              </div>

              {/* BANK / PROVIDER */}
              <div className="form-group">
                <label className="form-label">
                  Bank / Provider
                </label>

                <input
                  className="form-input"
                  name="provider"
                  value={form.provider}
                  onChange={handleChange}
                  placeholder={
                    form.type === 'fd'
                      ? 'e.g. HDFC Bank'
                      : 'e.g. Zerodha / SBI / MMTC'
                  }
                />
              </div>

              {/* PLATFORM */}
              <div className="form-group">
                <label className="form-label">
                  Platform
                </label>

                <input
                  className="form-input"
                  name="platform"
                  value={form.platform}
                  onChange={handleChange}
                  placeholder="e.g. Zerodha, Groww, Bank App"
                />
              </div>

              {/* RECEIPT */}
              <div className="form-group">
                <label className="form-label">
                  Receipt / Document
                  <span
                    style={{
                      color:
                        'var(--text-muted)',
                      fontWeight: 400,
                      marginLeft: 5
                    }}
                  >
                    (Optional)
                  </span>
                </label>

                <input
                  className="form-input"
                  type="file"
                  name="receipt"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={handleChange}
                />

                <small
                  style={{
                    color:
                      'var(--text-muted)',
                    display: 'block',
                    marginTop: 5
                  }}
                >
                  JPG, PNG, WEBP or PDF ·
                  Maximum 5 MB
                </small>
              </div>

              {/* CUSTOM MESSAGE */}
              <div className="form-group">
                <label className="form-label">
                  Custom Message
                </label>

                <textarea
                  className="form-input"
                  name="custom_message"
                  value={
                    form.custom_message
                  }
                  onChange={handleChange}
                  rows={3}
                  placeholder="Add any notes about this investment..."
                  style={{
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* BUTTONS */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 24
                }}
              >

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Update Investment'
                      : 'Save Investment'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}