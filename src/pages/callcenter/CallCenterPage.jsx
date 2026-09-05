import React, { useEffect, useState } from 'react';
import { callCenterApi, receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ExcelImportModal } from './ExcelImportModal';
import { useToast } from '../../context/ToastContext';
import { Headset, PhoneIncoming, PhoneOutgoing, Award, Search, Upload, Plus, UserCheck, CheckCircle2 } from 'lucide-react';

export const CallCenterPage = () => {
  const [activeTab, setActiveTab] = useState('leads');
  const [leads, setLeads] = useState([]);
  const [incentives, setIncentives] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search filter states
  const [leadsSearchTerm, setLeadsSearchTerm] = useState('');
  const [incentivesSearchTerm, setIncentivesSearchTerm] = useState('');

  // Inbound search state
  const [inboundMobile, setInboundMobile] = useState('');
  const [inboundResult, setInboundResult] = useState(null);
  const [searchingInbound, setSearchingInbound] = useState(false);

  // Quick lead creation form
  const [quickLead, setQuickLead] = useState({
    lead_name: '',
    mobile_number: '',
    lead_source: 'Inbound Call',
    campaign: 'General Inquiry',
    remarks: '',
  });
  const [savingLead, setSavingLead] = useState(false);

  // Excel import modal
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const { showToast } = useToast();

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.getExecutiveLeads();
      if (res.success) setLeads(res.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch executive leads queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncentives = async () => {
    setLoading(true);
    try {
      const res = await callCenterApi.getExecutiveIncentives();
      if (res.success) setIncentives(res.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch executive incentives', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'leads') fetchLeads();
    else if (activeTab === 'incentives') fetchIncentives();
  }, [activeTab]);

  const handleInboundSearch = async (e) => {
    e.preventDefault();
    if (!inboundMobile.trim()) return;

    setSearchingInbound(true);
    setInboundResult(null);
    try {
      const res = await callCenterApi.searchPatientInbound({ mobile_number: inboundMobile.trim() });
      if (res.success) {
        setInboundResult(res.data);
        if (!res.data.is_existing_patient) {
          setQuickLead((prev) => ({ ...prev, mobile_number: inboundMobile.trim() }));
        }
      }
    } catch (err) {
      showToast(err.message || 'Inbound lookup failed', 'error');
    } finally {
      setSearchingInbound(false);
    }
  };

  const handleCreateQuickLead = async (e) => {
    e.preventDefault();
    if (!quickLead.lead_name || !quickLead.mobile_number) return;

    setSavingLead(true);
    try {
      const res = await callCenterApi.createLead({
        ...quickLead,
        branch_id: 1,
      });

      if (res.success) {
        showToast('Lead created and routed to Receptionist Queue', 'success');
        setQuickLead({ lead_name: '', mobile_number: '', lead_source: 'Inbound Call', campaign: 'General Inquiry', remarks: '' });
        setInboundResult(null);
        setInboundMobile('');
        fetchLeads();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create lead', 'error');
    } finally {
      setSavingLead(false);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const filteredLeads = leads.filter((l) => {
    if (!leadsSearchTerm.trim()) return true;
    const q = leadsSearchTerm.toLowerCase();
    const name = (l.lead_name || '').toLowerCase();
    const mobile = (l.mobile_number || '').toLowerCase();
    const campaign = (l.campaign || '').toLowerCase();
    const source = (l.lead_source || '').toLowerCase();
    const exec = (l.executive_name || '').toLowerCase();
    return name.includes(q) || mobile.includes(q) || campaign.includes(q) || source.includes(q) || exec.includes(q);
  });

  const filteredIncentives = incentives.filter((i) => {
    if (!incentivesSearchTerm.trim()) return true;
    const q = incentivesSearchTerm.toLowerCase();
    return (i.executive_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Headset className="w-5 h-5 text-blue-600" />
            <span>Call Center & Executive Lead Queue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Incoming caller identification, outbound batch imports, and executive incentive accruals
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Outbound Excel Leads</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: 'leads', label: 'Executive Leads Queue', icon: PhoneOutgoing },
          { id: 'inbound', label: 'Inbound Patient Search & Route', icon: PhoneIncoming },
          { id: 'incentives', label: 'Executive Incentives Matrix', icon: Award },
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

      {/* TAB 1: LEADS QUEUE */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Search Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={leadsSearchTerm}
                onChange={(e) => setLeadsSearchTerm(e.target.value)}
                placeholder="Search leads by name, mobile, campaign, or executive..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="text-slate-500 text-xs font-semibold">
              Showing <span className="font-bold text-slate-800">{filteredLeads.length}</span> of {leads.length} leads
            </div>
          </div>

          {loading ? (
            <LoadingSpinner label="Loading executive leads..." />
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-medium">
              {leadsSearchTerm ? `No leads found matching "${leadsSearchTerm}"` : 'No leads currently queued.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Lead Name</th>
                    <th className="py-3 px-4">Mobile</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Campaign</th>
                    <th className="py-3 px-4">Executive</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLeads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{l.lead_name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{l.mobile_number}</td>
                      <td className="py-3.5 px-4 text-slate-600">{l.lead_source}</td>
                      <td className="py-3.5 px-4 text-slate-600">{l.campaign || '—'}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {l.executive_name || `Exec #${l.created_by_executive_id}`}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INBOUND SEARCH */}
      {activeTab === 'inbound' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Incoming Caller Identification
            </h3>

            <form onSubmit={handleInboundSearch} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Incoming Caller Mobile *
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    placeholder="Enter 10-digit mobile"
                    value={inboundMobile}
                    onChange={(e) => setInboundMobile(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={searchingInbound}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {searchingInbound ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
            </form>

            {inboundResult && (
              <div className="mt-4 p-4 rounded-2xl border space-y-2 bg-slate-50 border-slate-200 text-xs">
                {inboundResult.is_existing_patient ? (
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Existing Hospital Patient
                    </span>
                    <h4 className="text-base font-bold text-slate-900 mt-2">
                      {inboundResult.patient?.full_name}
                    </h4>
                    <p className="text-slate-500 text-[11px]">
                      Patient ID: #{inboundResult.patient?.patient_id} • Age: {inboundResult.patient?.age} • Gender: {inboundResult.patient?.gender}
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      New Inbound Caller
                    </span>
                    <p className="text-slate-600 text-xs mt-2 font-medium">
                      No prior patient record found for {inboundMobile}. Fill in the form on the right to route this lead directly to the Receptionist booking queue.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Quick Lead Creation & Receptionist Routing
            </h3>

            <form onSubmit={handleCreateQuickLead} className="space-y-3 text-xs text-slate-700">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Lead / Caller Name *</label>
                <input
                  type="text"
                  required
                  value={quickLead.lead_name}
                  onChange={(e) => setQuickLead({ ...quickLead, lead_name: e.target.value })}
                  placeholder="e.g. Anand Varma"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={quickLead.mobile_number}
                  onChange={(e) => setQuickLead({ ...quickLead, mobile_number: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Source</label>
                  <input
                    type="text"
                    value={quickLead.lead_source}
                    onChange={(e) => setQuickLead({ ...quickLead, lead_source: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Campaign</label>
                  <input
                    type="text"
                    value={quickLead.campaign}
                    onChange={(e) => setQuickLead({ ...quickLead, campaign: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={quickLead.remarks}
                  onChange={(e) => setQuickLead({ ...quickLead, remarks: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingLead}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingLead ? 'Routing...' : 'Route to Receptionist Queue'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: INCENTIVES */}
      {activeTab === 'incentives' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Search Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={incentivesSearchTerm}
                onChange={(e) => setIncentivesSearchTerm(e.target.value)}
                placeholder="Search by executive name..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="text-slate-500 text-xs font-semibold">
              Showing <span className="font-bold text-slate-800">{filteredIncentives.length}</span> of {incentives.length} executives
            </div>
          </div>

          {loading ? (
            <LoadingSpinner label="Calculating executive incentives..." />
          ) : filteredIncentives.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-medium">
              {incentivesSearchTerm ? `No executive incentives found matching "${incentivesSearchTerm}"` : 'No executive incentive accruals recorded for this month.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Executive</th>
                    <th className="py-3 px-4">Leads Generated</th>
                    <th className="py-3 px-4">Per-Lead Incentive</th>
                    <th className="py-3 px-4 text-right">Earned Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredIncentives.map((i) => (
                    <tr key={i.executive_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{i.executive_name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{i.leads_count}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">₹{i.per_lead_incentive}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(i.earned_incentive)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImportSuccess={fetchLeads}
      />
    </div>
  );
};
