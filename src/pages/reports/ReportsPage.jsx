import React, { useEffect, useState } from 'react';
import { reportsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { BarChart3, Users, DollarSign, Target, Headset, Pill, Layers } from 'lucide-react';

export const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('revenue');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const { showToast } = useToast();

  const fetchReport = async (tab) => {
    setLoading(true);
    setData(null);
    try {
      let res;
      if (tab === 'patient') res = await reportsApi.getPatientReport();
      else if (tab === 'revenue') res = await reportsApi.getRevenueReport();
      else if (tab === 'target') res = await reportsApi.getTargetReport({});
      else if (tab === 'executive') res = await reportsApi.getExecutiveReport();
      else if (tab === 'pharmacy') res = await reportsApi.getPharmacyReport();
      else if (tab === 'crm') res = await reportsApi.getCrmReport();

      if (res && res.success) setData(res.data);
    } catch (err) {
      showToast(err.message || 'Failed to fetch report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>Super Admin Intelligence & Analytical Reports</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consolidated clinical, financial, quota achievement, executive, and pharmacy stock reports
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {[
          { id: 'revenue', label: 'Revenue & Finance', icon: DollarSign },
          { id: 'patient', label: 'Patient Statistics', icon: Users },
          { id: 'target', label: 'Monthly Targets', icon: Target },
          { id: 'executive', label: 'Call Center & Leads', icon: Headset },
          { id: 'pharmacy', label: 'Pharmacy & Stock', icon: Pill },
          { id: 'crm', label: 'CRM & Follow-ups', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingSpinner label="Compiling report metrics..." />
      ) : (
        <div className="space-y-6">
          {/* TAB: REVENUE */}
          {activeTab === 'revenue' && data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Grand Total Revenue
                  </span>
                  <div className="text-3xl font-black text-blue-700 mt-1 font-mono">
                    {formatCurrency(data.grand_total)}
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">Across all successful payment transactions</span>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Total Outstanding Due
                  </span>
                  <div className="text-3xl font-black text-red-600 mt-1 font-mono">
                    {formatCurrency(data.outstanding_due)}
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">Pending patient due amounts</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                  Payment Method Breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Object.entries(data.payment_method_breakdown || {}).map(([method, val]) => (
                    <div key={method} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[11px] font-bold text-slate-500 uppercase block capitalize">
                        {method.replace('_', ' ')}
                      </span>
                      <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                        {formatCurrency(val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PATIENTS */}
          {activeTab === 'patient' && data && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-blue-700 uppercase">New Patients</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{data.new_patients}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-indigo-700 uppercase">Existing Patients</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{data.existing_patients}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-sky-700 uppercase">Appointments</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{data.total_appointments}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-purple-700 uppercase">Renewals</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{data.total_renewals}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-cyan-700 uppercase">Referrals</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{data.total_referrals}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-red-700 uppercase">Due Patients</span>
                <div className="text-2xl font-black text-red-600 mt-1">{data.pending_due_patients}</div>
                <span className="text-[10px] text-slate-400 font-mono">{formatCurrency(data.pending_due_amount)}</span>
              </div>
            </div>
          )}

          {/* TAB: TARGET */}
          {activeTab === 'target' && data && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">
                    Monthly Target Progress ({data.month}/{data.year})
                  </h3>
                  <span className="text-xs text-slate-500">Enquiry + Unit = Overall Target</span>
                </div>
                <span className="text-xl font-black text-blue-700 font-mono">{data.achievement_pct}%</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Overall Target</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(data.overall_target)}</div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">Achieved: {formatCurrency(data.overall_achieved)}</div>
                  <div className="text-xs text-red-600 font-medium">Remaining: {formatCurrency(data.remaining)}</div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 text-center">
                  <span className="text-[11px] font-bold text-blue-800 uppercase">Enquiry Target</span>
                  <div className="text-xl font-bold text-blue-950 mt-1">{formatCurrency(data.enquiry_target)}</div>
                  <span className="text-[11px] text-slate-500 mt-1 block">New walk-ins & calls</span>
                </div>

                <div className="p-4 rounded-2xl bg-red-50/50 border border-red-200 text-center">
                  <span className="text-[11px] font-bold text-red-800 uppercase">Unit Target</span>
                  <div className="text-xl font-bold text-red-950 mt-1">{formatCurrency(data.unit_target)}</div>
                  <span className="text-[11px] text-slate-500 mt-1 block">Renewals, referrals & dues</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EXECUTIVE */}
          {activeTab === 'executive' && data && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Total Leads</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{data.total_leads}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-cyan-700 uppercase">Inbound Leads</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{data.inbound_leads}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-blue-700 uppercase">Outbound Leads</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{data.outbound_leads}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">Converted Leads</span>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{data.converted_leads}</div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-800 uppercase">
                  Executive Performance Breakdown
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                      <th className="py-3 px-4">Executive</th>
                      <th className="py-3 px-4">Leads Count</th>
                      <th className="py-3 px-4">Per-Lead Rate</th>
                      <th className="py-3 px-4 text-right">Earned Incentive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data.executive_performance || []).map((ep) => (
                      <tr key={ep.executive_id}>
                        <td className="py-3 px-4 font-bold text-slate-900">{ep.executive_name}</td>
                        <td className="py-3 px-4 font-mono">{ep.leads_count}</td>
                        <td className="py-3 px-4 font-mono">₹{ep.per_lead_incentive}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono">
                          {formatCurrency(ep.incentive)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PHARMACY */}
          {activeTab === 'pharmacy' && data && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Catalog Items</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{data.total_medicine_masters}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Stock Quantity</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{data.total_stock_quantity}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-amber-200">
                <span className="text-[11px] font-bold text-amber-700 uppercase">Low Stock Items</span>
                <div className="text-2xl font-black text-amber-600 mt-1">{data.low_stock_items_count}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-red-200">
                <span className="text-[11px] font-bold text-red-700 uppercase">Expiring Batches</span>
                <div className="text-2xl font-black text-red-600 mt-1">{data.expiring_batches_count}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Out of Stock</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{data.out_of_stock_count}</div>
              </div>
            </div>
          )}

          {/* TAB: CRM */}
          {activeTab === 'crm' && data && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs uppercase text-slate-700">Follow-ups by Status</h4>
                <div className="space-y-1 text-xs">
                  {(data.followups_by_status || []).map((f) => (
                    <div key={f.status} className="flex justify-between py-1 border-b border-slate-100">
                      <span className="capitalize text-slate-600">{f.status}:</span>
                      <span className="font-mono font-bold text-slate-900">{f.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center flex flex-col justify-center">
                <span className="text-xs font-bold text-blue-700 uppercase">Active ACQ Care Plans</span>
                <div className="text-3xl font-black text-slate-900 mt-2">{data.active_acq_patients}</div>
                <span className="text-[11px] text-slate-400 mt-1">Subscribed monthly patients</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs uppercase text-slate-700">OC / NR Classification</h4>
                <div className="space-y-1 text-xs">
                  {(data.oc_nr_classification || []).map((o) => (
                    <div key={o.classification} className="flex justify-between py-1 border-b border-slate-100">
                      <span className="uppercase text-slate-600">{o.classification}:</span>
                      <span className="font-mono font-bold text-slate-900">{o.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
