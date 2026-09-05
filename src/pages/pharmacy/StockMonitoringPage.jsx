import React, { useEffect, useState } from 'react';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { Package, AlertTriangle, Clock, Plus, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const StockMonitoringPage = () => {
  const [stock, setStock] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [expiringFilter, setExpiringFilter] = useState(false);

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockForm, setStockForm] = useState({
    medicine_id: '',
    batch_number: '',
    expiry_date: '',
    quantity: 100,
    transaction_type: 'in',
    reference: 'Invoice Supply',
  });
  const [savingStock, setSavingStock] = useState(false);

  const { showToast } = useToast();

  const fetchStock = async () => {
    setLoading(true);
    try {
      const params = {};
      if (lowStockFilter) params.low_stock = 'true';
      if (expiringFilter) params.expiring = 'true';

      const [stockRes, medsRes] = await Promise.all([
        pharmacyApi.getStock(params),
        pharmacyApi.getMedicines({}),
      ]);

      if (stockRes.success) setStock(stockRes.data || []);
      if (medsRes.success) setMedicines(medsRes.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch stock inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [lowStockFilter, expiringFilter]);

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!stockForm.medicine_id || !stockForm.batch_number || !stockForm.expiry_date) {
      showToast('Medicine, batch number, and expiry date are required', 'warning');
      return;
    }

    setSavingStock(true);
    try {
      const res = await pharmacyApi.addStock({
        ...stockForm,
        medicine_id: parseInt(stockForm.medicine_id),
        quantity: parseInt(stockForm.quantity) || 0,
      });

      if (res.success) {
        showToast('Stock batch logged and added to inventory', 'success');
        setIsStockModalOpen(false);
        setStockForm({
          medicine_id: '',
          batch_number: '',
          expiry_date: '',
          quantity: 100,
          transaction_type: 'in',
          reference: 'Invoice Supply',
        });
        fetchStock();
      }
    } catch (err) {
      showToast(err.message || 'Failed to add stock batch', 'error');
    } finally {
      setSavingStock(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span>Pharmacy Stock & Expiry Surveillance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Batch tracking, shelf-life monitoring, reorder alerts, and supply receipts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setLowStockFilter(!lowStockFilter)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              lowStockFilter
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Low Stock Only (≤ Reorder)
          </button>

          <button
            onClick={() => setExpiringFilter(!expiringFilter)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              expiringFilter
                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Expiring Batches (≤ 30 Days)
          </button>

          <button
            onClick={() => setIsStockModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Receive Inward Stock</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading stock inventory levels..." />
        ) : stock.length === 0 ? (
          <EmptyState
            title="No stock records match filters"
            description="Receive inward stock or adjust filters to view batches."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Medicine</th>
                  <th className="py-3.5 px-4">Batch Number</th>
                  <th className="py-3.5 px-4">Stock Quantity</th>
                  <th className="py-3.5 px-4">Reorder Threshold</th>
                  <th className="py-3.5 px-4">Expiry Date</th>
                  <th className="py-3.5 px-4 text-right">Surveillance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {stock.map((s) => {
                  const isLow = s.quantity <= s.reorder_level;
                  const daysToExpiry = Math.ceil(
                    (new Date(s.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
                  );
                  const isExpiring = daysToExpiry <= 30;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{s.medicine_name}</div>
                        <div className="text-[11px] text-slate-400">{s.category}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700 font-semibold">
                        {s.batch_number}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-900 font-bold text-sm">
                        {s.quantity} {s.unit}s
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {s.reorder_level} {s.unit}s
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {s.expiry_date ? new Date(s.expiry_date).toLocaleDateString() : 'N/A'}
                        {isExpiring && (
                          <span className="text-[10px] text-red-600 block font-sans font-bold">
                            Expires in {daysToExpiry} days
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {isLow && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                            Low Stock
                          </span>
                        )}
                        {isExpiring && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-800 border border-red-200 uppercase">
                            Expiring
                          </span>
                        )}
                        {!isLow && !isExpiring && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                            Adequate
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Inward Stock */}
      <Modal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        title="Receive Inward Stock Shipment"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddStock} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Medicine *</label>
            <select
              required
              value={stockForm.medicine_id}
              onChange={(e) => setStockForm({ ...stockForm, medicine_id: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Select Medicine Item --</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.medicine_name} ({m.strength})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Batch Number *</label>
              <input
                type="text"
                required
                value={stockForm.batch_number}
                onChange={(e) => setStockForm({ ...stockForm, batch_number: e.target.value })}
                placeholder="BATCH-9082"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={stockForm.expiry_date}
                onChange={(e) => setStockForm({ ...stockForm, expiry_date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Inward Quantity *</label>
              <input
                type="number"
                required
                value={stockForm.quantity}
                onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Transaction Type</label>
              <select
                value={stockForm.transaction_type}
                onChange={(e) => setStockForm({ ...stockForm, transaction_type: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="in">Stock In (Supply)</option>
                <option value="adjustment">Stock Adjustment</option>
                <option value="return">Patient Return</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Invoice Reference</label>
            <input
              type="text"
              value={stockForm.reference}
              onChange={(e) => setStockForm({ ...stockForm, reference: e.target.value })}
              placeholder="Invoice # / PO #"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsStockModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingStock}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingStock ? 'Receiving...' : 'Add Stock Batch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
