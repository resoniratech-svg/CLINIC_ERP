import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { AilmentSelect } from '../../components/common/AilmentSelect';
import { LeadDetailsModal } from './LeadDetailsModal';
import { EditLeadModal } from './EditLeadModal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Users2,
  UserPlus,
  HeartHandshake,
  UserX,
  History,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Send,
  PhoneIncoming,
  PhoneForwarded,
  Pencil
} from 'lucide-react';

export const ExecutiveLeadsPage = () => {
  const location = useLocation();
  const path = location.pathname;

  // Determine active tab from URL
  let initialTab = 'all';
  if (path.includes('/interested')) initialTab = 'interested';
  else if (path.includes('/not-interested')) initialTab = 'not_interested';
  else if (path.includes('/new')) initialTab = 'new';
  else if (path.includes('/history')) initialTab = 'all';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [editingLead, setEditingLead] = useState(null);

  // New Lead Modal State
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(path.includes('/new'));
  const [newLeadForm, setNewLeadForm] = useState({
    lead_name: '',
    mobile_number: '',
    age: '',
    gender: 'male',
    village: '',
    mandal: '',
    requirement: '',
    lead_source: 'inbound',
    campaign: '',
    remarks: ''
  });
  const [submittingLead, setSubmittingLead] = useState(false);

  const { showToast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (path.includes('/interested')) setActiveTab('interested');
    else if (path.includes('/not-interested')) setActiveTab('not_interested');
    else if (path.includes('/new')) {
      setActiveTab('new');
      setIsNewLeadOpen(true);
    } else if (path.includes('/history')) setActiveTab('all');
    else setActiveTab('all');
  }, [path]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeTab !== 'all' && activeTab !== 'new') {
        params.status = activeTab;
      }
      if (activeTab === 'new') {
        params.status = 'new';
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await executiveApi.getLeads(params);
      if (res.success && res.data) {
        setLeads(res.data);
      } else {
        showToast('Failed to load executive leads', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error fetching leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [activeTab, searchTerm]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadForm.lead_name.trim() || !newLeadForm.mobile_number.trim()) {
      showToast('Lead Name and Mobile Number are required', 'warning');
      return;
    }

    setSubmittingLead(true);
    try {
      const payload = {
        lead_name: newLeadForm.lead_name.trim(),
        mobile_number: newLeadForm.mobile_number.trim(),
        age: newLeadForm.age ? parseInt(newLeadForm.age) : null,
        gender: newLeadForm.gender,
        village: newLeadForm.village.trim() || null,
        mandal: newLeadForm.mandal.trim() || null,
        requirement: newLeadForm.requirement.trim() || null,
        source: newLeadForm.lead_source === 'outbound' ? 'Outbound Call' : 'Inbound Call',
        lead_source: newLeadForm.lead_source,
        campaign: newLeadForm.campaign.trim() || null,
        remarks: newLeadForm.remarks.trim() || null
      };

      const res = await executiveApi.createLead(payload);
      if (res.success && res.data) {
        showToast('Lead created successfully! Routed to Receptionist Lead Queue.', 'success');
        setIsNewLeadOpen(false);
        setNewLeadForm({
          lead_name: '',
          mobile_number: '',
          age: '',
          gender: 'male',
          village: '',
          mandal: '',
          requirement: '',
          lead_source: 'inbound',
          campaign: '',
          remarks: ''
        });
        fetchLeads();
      } else {
        showToast('Failed to create lead', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error generating lead', 'error');
    } finally {
      setSubmittingLead(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Executive Leads Registry
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
              {leads.length} Leads
            </span>
          </div>
          <p className="text-xs text-slate-500">
            All leads generated by your phone interactions • Automatically handed off to Receptionist Queue for Doctor Assignment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsNewLeadOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Create Lead</span>
          </button>
        </div>
      </div>

      {/* 2. Tabs Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'all'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Leads
        </button>

        <button
          onClick={() => setActiveTab('new')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'new'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          New / Pending Leads
        </button>

        <button
          onClick={() => setActiveTab('interested')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'interested'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Interested
        </button>

        <button
          onClick={() => setActiveTab('not_interested')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'not_interested'
              ? 'bg-white text-red-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Not Interested
        </button>
      </div>

      {/* 3. Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search leads by patient name or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 4. Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="Fetching executive leads registry..." />
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Users2 className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No leads found in this view</p>
            <p className="text-[11px] text-slate-400">Create a new lead from Inbound or Outbound calls.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4"># Lead ID</th>
                  <th className="py-3 px-4">Patient / Lead Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Channel / Source</th>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {leads.map((lead) => (
                  <tr key={lead.lead_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      LEAD-{String(lead.lead_id).padStart(5, '0')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{lead.lead_name}</div>
                      <div className="text-[10px] text-slate-400">
                        {lead.village || lead.mandal ? `${lead.village || ''} ${lead.mandal ? `(${lead.mandal})` : ''}` : '—'}
                      </div>
                      {(lead.requirement || lead.problem) && (
                        <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-medium">
                          <span className="font-bold">Ailment:</span> {lead.requirement || lead.problem}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {lead.mobile_number}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 capitalize">
                        {lead.lead_source === 'inbound' ? (
                          <PhoneIncoming className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <PhoneForwarded className="w-3 h-3 text-blue-600" />
                        )}
                        <span>{lead.lead_source || 'Inbound'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                      {lead.campaign || 'Direct Call'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          lead.status === 'new'
                            ? 'bg-blue-100 text-blue-800'
                            : lead.status === 'interested'
                            ? 'bg-emerald-100 text-emerald-800'
                            : lead.status === 'converted'
                            ? 'bg-purple-100 text-purple-800'
                            : lead.status === 'not_interested'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingLead(lead)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          title="Edit Lead Information"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setSelectedLeadId(lead.lead_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Lead Details Modal */}
      <LeadDetailsModal
        isOpen={Boolean(selectedLeadId)}
        onClose={() => setSelectedLeadId(null)}
        leadId={selectedLeadId}
        onEditLead={(lead) => {
          setSelectedLeadId(null);
          setEditingLead(lead);
        }}
      />

      {/* 6. Edit Lead Modal */}
      <EditLeadModal
        isOpen={Boolean(editingLead)}
        onClose={() => setEditingLead(null)}
        lead={editingLead}
        onLeadUpdated={() => {
          fetchLeads();
          setEditingLead(null);
        }}
      />

      {/* 6. Create New Lead Modal */}
      <Modal
        isOpen={isNewLeadOpen}
        onClose={() => setIsNewLeadOpen(false)}
        title="Create New Lead • Handoff to Receptionist"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateLead} className="space-y-4 text-xs text-slate-800">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Caller / Lead Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Reddy"
                value={newLeadForm.lead_name}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, lead_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="10-digit number"
                value={newLeadForm.mobile_number}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Channel
              </label>
              <select
                value={newLeadForm.lead_source}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, lead_source: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="inbound">Inbound Call</option>
                <option value="outbound">Outbound Campaign</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Age
              </label>
              <input
                type="number"
                placeholder="e.g. 35"
                value={newLeadForm.age}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, age: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Gender
              </label>
              <select
                value={newLeadForm.gender}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, gender: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Village / Locality
              </label>
              <input
                type="text"
                placeholder="e.g. Subhash Nagar"
                value={newLeadForm.village}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, village: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Campaign Tag
              </label>
              <input
                type="text"
                placeholder="e.g. Health Camp / Social"
                value={newLeadForm.campaign}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, campaign: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <AilmentSelect
            label="Requirement / Reason"
            labelClassName="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1"
            required
            placeholder="e.g. Back Pain, Skin Allergy, Gastric Consultation"
            value={newLeadForm.requirement}
            onChange={(e) => setNewLeadForm({ ...newLeadForm, requirement: e.target.value })}
            inputClassName="bg-slate-50 border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
              Remarks
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Patient agreed to visit clinic this week."
              value={newLeadForm.remarks}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, remarks: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewLeadOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submittingLead}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {submittingLead ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Save Lead & Route to Receptionist</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
