import React, { useState, useEffect } from 'react';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  AlertCircle,
  Search,
  DollarSign,
  CreditCard,
  CheckCircle2,
  PhoneCall,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DuePatientsPage = () => {
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Collect Payment Modal
  const [collectTarget, setCollectTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [collecting, setCollecting] = useState(false);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchDues = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.getDuePatients();
      if (res.success) {
        setDues(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch due patients', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDues();
  }, []);

  const handleCollectSubmit = async (e) => {
    e.preventDefault();
    if (!collectTarget) return;

    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0 || amount > parseFloat(collectTarget.due_amount)) {
      showToast(`Please enter a valid amount up to ₹${collectTarget.due_amount}`, 'warning');
      return;
    }

    setCollecting(true);
    try {
      const res = await receptionistApi.collectDuePayment(collectTarget.id, {
        payment_amount: amount,
        payment_method: payMethod,
      });

      if (res.success) {
        showToast('Due payment collected successfully!', 'success');
        setCollectTarget(null);
        setPayAmount('');
        fetchDues();
      }
    } catch (err) {
      showToast(err.message || 'Payment collection failed', 'error');
    } finally {
      setCollecting(false);
    }
  };

  const filteredDues = dues.filter(
    (d) =>
      d.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.mobile_number?.includes(searchTerm) ||
      d.registration_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span>Due Patients & Outstanding Balances</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Surveillance and collection of partial fee balances (Contributes directly to Unit Target collections).
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Patient Name, Mobile, or Reg ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Total Due Patients: <span className="font-bold text-amber-700">{filteredDues.length}</span>
        </div>
      </div>

      {/* Dues Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading due records..." />
        ) : filteredDues.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            No outstanding patient dues currently pending.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Patient Profile</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Associated Bill</th>
                  <th className="py-3.5 px-4">Outstanding Due</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDues.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{d.patient_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {d.registration_id} • ID #{d.patient_id}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {d.mobile_number}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {d.bill_number || `Bill #${d.bill_id}`}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-red-600">
                      {formatCurrency(d.due_amount)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 capitalize">
                        {d.status || 'Pending'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => {
                          setCollectTarget(d);
                          setPayAmount(String(d.due_amount));
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Collect Payment</span>
                      </button>

                      <button
                        onClick={() =>
                          navigate('/receptionist/crm', {
                            state: {
                              patient: {
                                patient_id: d.patient_id,
                                patient_name: d.patient_name,
                                mobile_number: d.mobile_number,
                              },
                              callPurpose: 'due_payment',
                            },
                          })
                        }
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-red-600" />
                        <span>Call</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collect Payment Modal */}
      {collectTarget && (
        <Modal
          isOpen={true}
          onClose={() => setCollectTarget(null)}
          title={`Collect Due: ${collectTarget.patient_name}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCollectSubmit} className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-900 block">{collectTarget.patient_name}</span>
                <span className="text-[11px] text-slate-500 font-mono">{collectTarget.registration_id}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Due</span>
                <span className="font-mono font-bold text-red-600 text-sm">₹{collectTarget.due_amount}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Collection Amount (₹) *
              </label>
              <input
                type="number"
                required
                min="1"
                max={collectTarget.due_amount}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Method *
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI / QR</option>
                <option value="card">Card</option>
                <option value="razorpay">Razorpay</option>
                <option value="bajaj_pay">Bajaj Pay</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCollectTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={collecting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
              >
                {collecting ? 'Processing...' : 'Confirm Collection'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
