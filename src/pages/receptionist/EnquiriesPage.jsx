import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  HelpCircle,
  Plus,
  Search,
  Phone,
  Calendar,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Users,
  X,
  MapPin,
  Clock,
  Filter
} from 'lucide-react';

export const EnquiriesPage = () => {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    age: '',
    gender: 'male',
    source: 'Phone Inquiry',
    lead_source: 'inbound',
    village_mandal: '',
    reason_requirement: '',
    remarks: '',
  });

  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchEnquiries = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.getEnquiries();
      if (res.success) {
        setEnquiries(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch enquiries', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Enquirer name is required', 'warning');
      return;
    }

    const cleanMobile = formData.mobile.trim();
    if (!cleanMobile || !/^[0-9]{10}$/.test(cleanMobile)) {
      showToast('Please enter a valid 10-digit mobile number', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await receptionistApi.createEnquiry({
        name: formData.name.trim(),
        mobile: cleanMobile,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        source: formData.source,
        lead_source: formData.lead_source,
        village_mandal: formData.village_mandal.trim() || null,
        reason_requirement: formData.reason_requirement.trim() || null,
        remarks: formData.remarks.trim() || null,
      });

      if (res.success) {
        showToast('Enquiry recorded successfully! Routed to Enquiry Target.', 'success');
        setIsModalOpen(false);
        setFormData({
          name: '',
          mobile: '',
          age: '',
          gender: 'male',
          source: 'Phone Inquiry',
          lead_source: 'inbound',
          village_mandal: '',
          reason_requirement: '',
          remarks: '',
        });
        fetchEnquiries();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create enquiry', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEnquiries = enquiries.filter((enq) => {
    const matchesSearch =
      !searchQuery.trim() ||
      (enq.lead_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (enq.mobile_number || '').includes(searchQuery) ||
      String(enq.lead_id || '').includes(searchQuery);

    const matchesStatus =
      statusFilter === 'all' || (enq.status || '').toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-sky-600" />
            <span>Patient Enquiries Registry</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log patient inquiries from walk-ins and incoming calls. Contributes directly to Enquiry Target.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Log New Enquiry</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Lead Name, Mobile Number, or Enquiry ID..."
            className="w-full pl-10 pr-9 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
          </select>

          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl whitespace-nowrap">
            {filteredEnquiries.length} Record{filteredEnquiries.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Enquiries Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading patient enquiries..." />
        ) : filteredEnquiries.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            {searchQuery || statusFilter !== 'all'
              ? 'No enquiries match your search/filter criteria.'
              : 'No patient enquiries logged yet. Click "+ Log New Enquiry" to record one.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Enquiry ID & Lead Name</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Logged Date</th>
                  <th className="py-3.5 px-4 text-right">Convert / Register</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEnquiries.map((enq) => (
                  <tr key={enq.lead_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{enq.lead_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>Lead #{enq.lead_id}</span>
                        {enq.village && (
                          <span className="inline-flex items-center gap-0.5 text-slate-500">
                            <MapPin className="w-2.5 h-2.5 text-slate-400" />
                            {enq.village}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {enq.mobile_number}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="capitalize font-semibold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 text-[11px]">
                        {enq.source || enq.lead_source?.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          enq.status === 'converted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : enq.status === 'contacted'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {enq.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {enq.created_at ? new Date(enq.created_at).toLocaleDateString() : 'Today'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {enq.status !== 'converted' ? (
                        <button
                          onClick={() =>
                            navigate('/receptionist/patients/register', {
                              state: {
                                initialMobile: enq.mobile_number,
                                leadId: enq.lead_id,
                                leadSource: enq.source || 'phone_enquiry',
                                patientName: enq.lead_name,
                                age: enq.age,
                                gender: enq.gender,
                                ailment_reason: enq.requirement || enq.campaign || enq.remarks || '',
                                requirement: enq.requirement || '',
                                reason: enq.requirement || enq.campaign || enq.remarks || '',
                              },
                            })
                          }
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Convert to Patient</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-semibold inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{enq.converted_registration_id ? `Converted (${enq.converted_registration_id})` : 'Converted'}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log New Enquiry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Incoming Patient Enquiry"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Enquirer Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mobile Number (10 Digits) *</label>
              <input
                type="tel"
                required
                maxLength="10"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Age</label>
              <input
                type="number"
                min="1"
                max="120"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="e.g. 35"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Enquiry Channel / Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium"
              >
                <option value="Phone Inquiry">Phone Call (Inbound)</option>
                <option value="Walk-in Inquiry">Walk-in Inquiry</option>
                <option value="WhatsApp / Digital">WhatsApp / Digital</option>
                <option value="Website">Website</option>
                <option value="Referral">Patient / Employee Referral</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Village / Mandal / City</label>
              <input
                type="text"
                value={formData.village_mandal}
                onChange={(e) => setFormData({ ...formData, village_mandal: e.target.value })}
                placeholder="e.g. Karimnagar"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Requirement / Health Concern</label>
            <input
              type="text"
              value={formData.reason_requirement}
              onChange={(e) => setFormData({ ...formData, reason_requirement: e.target.value })}
              placeholder="e.g. Inquiring about homeopathic allergy and respiratory treatments"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? 'Saving...' : 'Save Enquiry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
