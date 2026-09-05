import React, { useState, useEffect } from 'react';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { Receipt, DollarSign, Search, Filter, Printer, CheckCircle2, AlertCircle } from 'lucide-react';

export const ConsultationBillingPage = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.getConsultationBills();
      if (res.success) {
        setBills(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch consultation bills', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const filteredBills = bills.filter(
    (b) =>
      b.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.bill_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.mobile_number?.includes(searchTerm)
  );

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <span>Consultation Fee Billing & Invoices</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit of OPD consultation receipts, discounts applied, payments collected, and partial dues.
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
            placeholder="Search by Bill #, Patient Name, or Mobile..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="font-bold text-slate-800">{filteredBills.length}</span> consultation bills
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading consultation bills..." />
        ) : filteredBills.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            No consultation bills found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Bill Invoice #</th>
                  <th className="py-3.5 px-4">Patient Profile</th>
                  <th className="py-3.5 px-4">Consultant Doctor</th>
                  <th className="py-3.5 px-4">Standard Fee</th>
                  <th className="py-3.5 px-4">Discount</th>
                  <th className="py-3.5 px-4">Final Payable</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredBills.map((b) => (
                  <tr key={b.bill_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                      {b.bill_number}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{b.patient_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{b.mobile_number}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800">Dr. {b.doctor_name}</span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {formatCurrency(b.amount)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-red-600">
                      {b.discount_amount > 0 ? `-₹${b.discount_amount}` : '—'}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {formatCurrency(b.final_amount)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 capitalize">
                        {b.status || 'Paid'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString() : 'Today'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
