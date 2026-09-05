import React, { useEffect, useState } from 'react';
import { billingApi, doctorsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { Receipt, DollarSign, ShieldAlert, CheckCircle2, Percent, CreditCard, Stethoscope, ArrowUpRight } from 'lucide-react';

export const BillingConfigPage = () => {
  const [fees, setFees] = useState([]);
  const [rules, setRules] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fee modification form
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [feeForm, setFeeForm] = useState({
    new_consultation_fee: 500,
    renewal_consultation_fee: 300,
    followup_consultation_fee: 200,
  });
  const [savingFee, setSavingFee] = useState(false);

  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feesRes, rulesRes, docRes] = await Promise.all([
        billingApi.getConsultationFees(),
        billingApi.getBillingRules(),
        doctorsApi.getDoctors({ status: 'active' }),
      ]);

      if (feesRes.success) setFees(feesRes.data || []);
      if (rulesRes.success) setRules(rulesRes.data);
      if (docRes.success) setDoctors(docRes.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load billing configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDoctorChange = (e) => {
    const docId = e.target.value;
    setSelectedDoctorId(docId);
    if (docId) {
      const doc = doctors.find((d) => String(d.doctor_id) === String(docId));
      if (doc) {
        setFeeForm({
          new_consultation_fee: parseFloat(doc.new_consultation_fee) || 500,
          renewal_consultation_fee: parseFloat(doc.renewal_consultation_fee) || 300,
          followup_consultation_fee: parseFloat(doc.followup_consultation_fee) || 200,
        });
      }
    }
  };

  const handleFeeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      showToast('Please select a doctor', 'warning');
      return;
    }

    setSavingFee(true);
    try {
      const promises = [
        billingApi.setConsultationFee({
          doctor_id: parseInt(selectedDoctorId),
          appointment_type: 'new',
          fee_amount: parseFloat(feeForm.new_consultation_fee) || 0,
        }),
        billingApi.setConsultationFee({
          doctor_id: parseInt(selectedDoctorId),
          appointment_type: 'renewal',
          fee_amount: parseFloat(feeForm.renewal_consultation_fee) || 0,
        }),
        billingApi.setConsultationFee({
          doctor_id: parseInt(selectedDoctorId),
          appointment_type: 'followup',
          fee_amount: parseFloat(feeForm.followup_consultation_fee) || 0,
        }),
      ];

      await Promise.all(promises);
      showToast('Doctor consultation fees updated successfully', 'success');
      setSelectedDoctorId('');
      fetchData();
    } catch (err) {
      showToast(err.message || 'Failed to update consultation fees', 'error');
    } finally {
      setSavingFee(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <span>Billing Configuration & Consultation Fee Governance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure fee structures, approved discount thresholds, and accepted payment options
          </p>
        </div>
      </div>

      {/* Strict Role Segregation Notice */}
      <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
        <div className="space-y-1 text-blue-950 text-xs leading-relaxed">
          <span className="font-bold block">Hospital ERP Role Separation Policy</span>
          <p>
            • <strong>Receptionist:</strong> Authorized to collect <em>Consultation Fees only</em> upon patient registration/check-in.<br />
            • <strong>PRO / Manager:</strong> Authorized to handle <em>Treatment Billing, Package Plans, Discounts, and Accountant Duties</em>.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading billing matrices and financial rules..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Fees Table */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Configured Consultation Fee Matrix
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">{fees.length} active rates</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Doctor</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Fee (₹)</th>
                      <th className="py-3 px-4">Branch</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {fees.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div>Dr. {f.doctor_name}</div>
                          {f.doctor_code && (
                            <div className="text-[10px] text-slate-400 font-mono font-normal">
                              {f.doctor_code}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            f.appointment_type === 'new'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : f.appointment_type === 'renewal'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {f.appointment_type === 'new' ? 'NEW' : f.appointment_type === 'renewal' ? 'RENEWAL' : 'FOLLOW-UP'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          ₹{parseFloat(f.fee_amount || 0).toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          Karimnagar Main
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                            {f.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discount Rules */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Percent className="w-4 h-4 text-blue-600" />
                <span>Approved Discount Thresholds</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {(rules?.discount_rules || []).slice(0, 4).map((r) => (
                  <div key={r.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">{r.name}</div>
                      <div className="text-[11px] text-slate-500">Approver: {r.approver_role?.replace('_', ' ')}</div>
                    </div>
                    <span className="text-base font-mono font-black text-blue-700">{parseFloat(r.max_discount_pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fee Configuration Form */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
                Update Doctor Consultation Fees
              </h3>

              <form onSubmit={handleFeeSubmit} className="space-y-4 text-xs text-slate-700">
                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                    Select Doctor *
                  </label>
                  <select
                    required
                    value={selectedDoctorId}
                    onChange={handleDoctorChange}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- Select Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d.doctor_id} value={d.doctor_id}>
                        Dr. {d.full_name} ({d.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                    New Consultation Fee (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={feeForm.new_consultation_fee}
                    onChange={(e) => setFeeForm({ ...feeForm, new_consultation_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                    Renewal Consultation Fee (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={feeForm.renewal_consultation_fee}
                    onChange={(e) => setFeeForm({ ...feeForm, renewal_consultation_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                    Follow-up Consultation Fee (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={feeForm.followup_consultation_fee}
                    onChange={(e) => setFeeForm({ ...feeForm, followup_consultation_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingFee}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingFee ? 'Updating...' : 'Save Consultation Fees'}
                </button>
              </form>
            </div>

            {/* Payment Methods */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Accepted Payment Methods</span>
              </h3>
              <div className="space-y-1.5 text-xs">
                {(rules?.payment_methods || []).map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold uppercase text-[11px] text-slate-700">{pm.method_name.replace('_', ' ')}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Enabled</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
