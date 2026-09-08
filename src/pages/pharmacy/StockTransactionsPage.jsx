import React, { useEffect, useState } from 'react';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import {
  History,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Sliders,
  Calendar,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export const StockTransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const { showToast } = useToast();

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pharmacyApi.getStockTransactions({
        type: typeFilter || undefined,
        date: dateFilter || undefined,
        batch_number: batchFilter ? batchFilter.trim() : undefined,
      });
      if (res.success) {
        setTransactions(res.data || []);
      } else {
        setError(res.message || 'Failed to retrieve transactions');
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to load stock transactions';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 300);
    return () => clearTimeout(timer);
  }, [typeFilter, dateFilter, batchFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTransactions();
  };

  const getTypeBadge = (type, qty) => {
    switch (type) {
      case 'in':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
            <ArrowDownRight className="w-3 h-3" /> Stock In
          </span>
        );
      case 'out':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
            <ArrowUpRight className="w-3 h-3" /> Dispensed (Out)
          </span>
        );
      case 'adjustment':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-purple-100 text-purple-800 uppercase tracking-wider">
            <Sliders className="w-3 h-3" /> Adjustment
          </span>
        );
      case 'return':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
            <RotateCcw className="w-3 h-3" /> Returned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-800 uppercase tracking-wider">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stock Transaction Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete immutable audit trail of all inbound receipts, outbound dispensing, returns, and inventory adjustments
          </p>
        </div>
        <button
          onClick={fetchTransactions}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Batch Number..."
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden font-medium"
            >
              <option value="">All Movement Types</option>
              <option value="in">In (Receipt / Import)</option>
              <option value="out">Out (Dispensed)</option>
              <option value="adjustment">Adjustment</option>
              <option value="return">Return</option>
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
            />

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition shrink-0"
            >
              Filter
            </button>

            {(typeFilter || dateFilter || batchFilter) && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('');
                  setDateFilter('');
                  setBatchFilter('');
                }}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">Failed to Load Transactions</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{error}</p>
            <button
              onClick={fetchTransactions}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
            >
              Retry
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={History}
              title="No Transactions Found"
              description="No stock movement records match the specified filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-4">Txn ID</th>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Medicine & Strength</th>
                  <th className="p-4">Batch Number</th>
                  <th className="p-4 text-center">Quantity Delta</th>
                  <th className="p-4">Reference / Memo</th>
                  <th className="p-4">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const isPositive = tx.quantity > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-4 font-bold text-slate-400">#{tx.id}</td>
                      <td className="p-4 whitespace-nowrap text-slate-700">
                        <div className="font-semibold">{new Date(tx.created_at).toLocaleDateString()}</div>
                        <div className="text-2xs text-slate-400">
                          {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-4">{getTypeBadge(tx.transaction_type, tx.quantity)}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-sm">{tx.medicine_name}</div>
                        <div className="text-slate-400 text-2xs">{tx.potency || '30C'}</div>
                      </td>
                      <td className="p-4 font-mono font-semibold text-slate-700">{tx.batch_number || '—'}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`text-sm font-bold ${
                            isPositive ? 'text-emerald-600 font-mono' : 'text-blue-600 font-mono'
                          }`}
                        >
                          {isPositive ? `+${tx.quantity}` : tx.quantity}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 max-w-xs truncate" title={tx.reference || '—'}>
                        {tx.reference || '—'}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">{tx.performed_by_name || 'Pharmacist'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
