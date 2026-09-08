import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  X,
  User,
  Plus,
  Pill,
  Stethoscope,
  FileText,
  AlertCircle
} from 'lucide-react';

export const PrescriptionClarificationsPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [clarifications, setClarifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Close / Resolve modal state
  const [activeClarification, setActiveClarification] = useState(null);
  const [closeRemarks, setCloseRemarks] = useState('');
  const [closing, setClosing] = useState(false);

  // New Clarification Modal state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [rxLookupLoading, setRxLookupLoading] = useState(false);
  const [rxPreview, setRxPreview] = useState(null);
  const [newForm, setNewForm] = useState({
    prescription_id: '',
    prescription_item_id: '',
    issue_type: 'dosage_clarification',
    description: '',
    priority: 'normal',
    remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchClarifications = async () => {
    setLoading(true);
    try {
      const res = await pharmacyApi.getClarifications({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchTerm.trim() || undefined,
      });
      if (res.success) {
        setClarifications(res.data || []);
      } else {
        showToast(res.message || 'Failed to load clarifications', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to load clarifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClarifications();
  }, [statusFilter, priorityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchClarifications();
  };

  const handleVerifyPrescription = async () => {
    const rxId = parseInt(newForm.prescription_id);
    if (!rxId || isNaN(rxId)) {
      showToast('Please enter a valid numeric Prescription ID', 'warning');
      return;
    }

    setRxLookupLoading(true);
    try {
      const res = await pharmacyApi.processPrescription(rxId);
      if (res.success && res.data) {
        setRxPreview({
          patient_name: res.data.prescription?.patient_name || 'Patient',
          doctor_name: res.data.prescription?.doctor_name || 'Doctor',
          items: res.data.items || [],
        });
        showToast(`Loaded Rx #${rxId} for ${res.data.prescription?.patient_name}`, 'success');
      } else {
        setRxPreview(null);
        showToast(res.message || 'Prescription not found or not in dispensable status', 'warning');
      }
    } catch (err) {
      setRxPreview(null);
      showToast(err.message || 'Failed to verify prescription', 'error');
    } finally {
      setRxLookupLoading(false);
    }
  };

  const handleCloseClarification = async (e) => {
    e.preventDefault();
    if (!activeClarification) return;

    setClosing(true);
    try {
      const res = await pharmacyApi.closeClarification(activeClarification.id, {
        remarks: closeRemarks.trim() || undefined,
        resolution_notes: closeRemarks.trim() || undefined,
      });

      if (res.success) {
        showToast('Prescription clarification resolved and closed. Medicine unblocked for dispensing.', 'success');
        setActiveClarification(null);
        setCloseRemarks('');
        fetchClarifications();
      } else {
        showToast(res.message || 'Failed to close clarification', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error closing clarification', 'error');
    } finally {
      setClosing(false);
    }
  };

  const handleCreateClarification = async (e) => {
    e.preventDefault();
    if (!newForm.prescription_id || !newForm.description.trim()) {
      showToast('Prescription ID and question description are required', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await pharmacyApi.createClarification({
        prescription_id: parseInt(newForm.prescription_id),
        prescription_item_id: newForm.prescription_item_id ? parseInt(newForm.prescription_item_id) : undefined,
        issue_type: newForm.issue_type,
        description: newForm.description.trim(),
        priority: newForm.priority,
        remarks: newForm.remarks.trim() || undefined,
      });

      if (res.success) {
        showToast('Clarification request dispatched to prescribing doctor successfully', 'success');
        setIsNewModalOpen(false);
        setRxPreview(null);
        setNewForm({
          prescription_id: '',
          prescription_item_id: '',
          issue_type: 'dosage_clarification',
          description: '',
          priority: 'normal',
          remarks: '',
        });
        fetchClarifications();
      } else {
        showToast(res.message || 'Failed to raise clarification', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error submitting clarification', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatIssueType = (type) => {
    switch (type) {
      case 'dosage_clarification':
        return 'Dosage Clarification';
      case 'substitution_request':
        return 'Medicine Substitution';
      case 'medicine_unavailable':
        return 'Stock Unavailable';
      case 'quantity_clarification':
        return 'Quantity Discrepancy';
      case 'duration_clarification':
        return 'Duration Clarification';
      case 'prescription_error':
        return 'Prescription Error';
      case 'other':
      default:
        return type ? type.replace(/_/g, ' ') : 'Clinical Inquiry';
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" /> Urgent
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
            High
          </span>
        );
      case 'normal':
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
            Normal
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'responded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-purple-100 text-purple-800 uppercase tracking-wider">
            <MessageSquare className="w-3 h-3" /> Doctor Responded
          </span>
        );
      case 'resolved':
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" /> Resolved / Closed
          </span>
        );
      case 'open':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
            <Clock className="w-3 h-3" /> Awaiting Doctor
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Prescription Clarifications</h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative clinical communication channel for dosage, potency, and drug substitution inquiries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRxPreview(null);
              setIsNewModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Raise Clarification</span>
          </button>
          <button
            onClick={fetchClarifications}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Patient, Doctor, Medicine, or Rx ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                pharmacyApi.getClarifications({
                  status: statusFilter || undefined,
                  priority: priorityFilter || undefined,
                }).then(res => {
                  if (res.success) setClarifications(res.data || []);
                });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden font-medium"
        >
          <option value="">All Statuses</option>
          <option value="open">Awaiting Doctor Response</option>
          <option value="responded">Doctor Responded</option>
          <option value="closed">Closed / Resolved</option>
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden font-medium"
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>

        {(statusFilter || priorityFilter || searchTerm) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setPriorityFilter('');
              setSearchTerm('');
              pharmacyApi.getClarifications({}).then(res => {
                if (res.success) setClarifications(res.data || []);
              });
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Clarifications List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : clarifications.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={HelpCircle}
              title="No Clarifications Found"
              description="No open or resolved doctor clarifications matching your filters."
              actionText="Raise New Clarification"
              onAction={() => {
                setRxPreview(null);
                setIsNewModalOpen(true);
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-4">ID</th>
                  <th className="p-4">Prescription & Patient</th>
                  <th className="p-4">Doctor</th>
                  <th className="p-4">Item / Category</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Pharmacist Question</th>
                  <th className="p-4">Doctor Response</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clarifications.map((c) => {
                  const doctorResponseText = c.doctor_response || c.response;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-4 font-bold text-slate-400">#{c.id}</td>

                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-sm">
                          <Link
                            to={`/pharmacy/prescriptions/${c.prescription_id}/process`}
                            className="hover:text-blue-600 underline decoration-dotted"
                          >
                            Rx #{c.prescription_id}
                          </Link>
                        </div>
                        <div className="text-slate-600 font-medium text-xs mt-0.5">{c.patient_name}</div>
                        {c.mobile_number && (
                          <div className="text-2xs text-slate-400 font-mono">{c.mobile_number}</div>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                          <span>Dr. {c.doctor_name || 'Prescribing Doctor'}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        {c.medicine_name ? (
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1">
                              <Pill className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{c.medicine_name}</span>
                            </div>
                            {c.medicine_strength && (
                              <div className="text-2xs text-slate-500">{c.medicine_strength}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-2xs">Entire Prescription</span>
                        )}
                        <div className="text-2xs font-semibold text-slate-600 mt-1">
                          {formatIssueType(c.issue_type)}
                        </div>
                      </td>

                      <td className="p-4">{getPriorityBadge(c.priority)}</td>

                      <td className="p-4 max-w-xs">
                        <div className="text-slate-800 font-medium line-clamp-2">{c.description}</div>
                        <div className="text-2xs text-slate-400 mt-1">
                          By {c.raised_by_name || 'Pharmacist'} • {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="p-4 max-w-xs">
                        {doctorResponseText ? (
                          <div>
                            <div className="text-purple-900 font-medium bg-purple-50 p-2.5 rounded-xl line-clamp-3 border border-purple-100">
                              "{doctorResponseText}"
                            </div>
                            <div className="text-2xs text-purple-600 mt-1 font-medium">
                              Dr. {c.responded_by_name || c.doctor_name || 'Doctor'}
                              {c.responded_at && ` • ${new Date(c.responded_at).toLocaleDateString()}`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-2xs flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            Awaiting response...
                          </span>
                        )}
                      </td>

                      <td className="p-4">{getStatusBadge(c.status)}</td>

                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {c.status !== 'closed' && (
                            <button
                              onClick={() => {
                                setActiveClarification(c);
                                setCloseRemarks('');
                              }}
                              className="px-3 py-1.5 text-2xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer"
                            >
                              Resolve / Close
                            </button>
                          )}
                          <Link
                            to={`/pharmacy/prescriptions/${c.prescription_id}/process`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                            title="Process Prescription"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Close / Resolve Clarification Modal */}
      {activeClarification && (
        <Modal
          isOpen={!!activeClarification}
          onClose={() => setActiveClarification(null)}
          title={`Resolve Clarification #${activeClarification.id}`}
        >
          <form onSubmit={handleCloseClarification} className="space-y-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                <span className="font-bold text-slate-700">Prescription #{activeClarification.prescription_id}</span>
                <span className="text-slate-500">{activeClarification.patient_name}</span>
              </div>
              <p>
                <span className="font-semibold text-slate-600">Question:</span> {activeClarification.description}
              </p>
              {(activeClarification.doctor_response || activeClarification.response) ? (
                <div className="p-2 bg-purple-50 rounded-lg border border-purple-200 text-purple-900 mt-2">
                  <div className="font-bold text-purple-800 text-2xs uppercase tracking-wider mb-0.5">
                    Doctor Response:
                  </div>
                  <div>"{activeClarification.doctor_response || activeClarification.response}"</div>
                </div>
              ) : (
                <div className="text-slate-500 italic text-2xs mt-1">
                  Doctor has not submitted an explicit written response yet. Closing manually will unblock the item.
                </div>
              )}
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-2xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Resolving and closing this clarification will set the medication's dispense status back to <strong>Pending</strong>, allowing dispensing to proceed.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Resolution Remarks / Action Taken (Optional)
              </label>
              <textarea
                rows="3"
                value={closeRemarks}
                onChange={(e) => setCloseRemarks(e.target.value)}
                placeholder="e.g. Doctor approved substitution with Paracetamol 500mg; ready for dispensing..."
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveClarification(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={closing}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {closing ? 'Resolving...' : 'Resolve & Mark Closed'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New Clarification Modal */}
      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Raise Clarification to Doctor">
        <form onSubmit={handleCreateClarification} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Prescription ID *
              </label>
              <input
                type="number"
                value={newForm.prescription_id}
                onChange={(e) => {
                  setNewForm({ ...newForm, prescription_id: e.target.value, prescription_item_id: '' });
                  setRxPreview(null);
                }}
                placeholder="e.g. 458"
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <button
                type="button"
                onClick={handleVerifyPrescription}
                disabled={rxLookupLoading || !newForm.prescription_id}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {rxLookupLoading ? 'Verifying...' : 'Verify Rx'}
              </button>
            </div>
          </div>

          {/* Rx Preview Banner */}
          {rxPreview && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between font-semibold text-blue-900">
                <span>Patient: {rxPreview.patient_name}</span>
                <span>Dr. {rxPreview.doctor_name}</span>
              </div>
            </div>
          )}

          {/* Item Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Specific Medicine Item (Optional)
            </label>
            {rxPreview && rxPreview.items?.length > 0 ? (
              <select
                value={newForm.prescription_item_id}
                onChange={(e) => setNewForm({ ...newForm, prescription_item_id: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              >
                <option value="">Entire Prescription (General Clinical Query)</option>
                {rxPreview.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    Item #{it.id}: {it.medicine_name} ({it.potency || it.strength || ''}) — Qty {it.quantity}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={newForm.prescription_item_id}
                onChange={(e) => setNewForm({ ...newForm, prescription_item_id: e.target.value })}
                placeholder="Prescription Item ID (leave empty if entire Rx)"
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Issue Category *
              </label>
              <select
                value={newForm.issue_type}
                onChange={(e) => setNewForm({ ...newForm, issue_type: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              >
                <option value="dosage_clarification">Dosage Clarification</option>
                <option value="substitution_request">Medicine Substitution Request</option>
                <option value="medicine_unavailable">Medicine Unavailable / Stock</option>
                <option value="quantity_clarification">Quantity Discrepancy</option>
                <option value="duration_clarification">Course Duration Clarification</option>
                <option value="prescription_error">Prescription Error / Ambiguity</option>
                <option value="other">Other Clinical Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Priority</label>
              <select
                value={newForm.priority}
                onChange={(e) => setNewForm({ ...newForm, priority: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              >
                <option value="normal">Normal Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent (Immediate Patient Waiting)</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Clinical Question / Details *
            </label>
            <textarea
              rows="3"
              value={newForm.description}
              onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
              placeholder="State question clearly for prescribing doctor (e.g. Current stock is 30C rather than 200C. Is 30C acceptable?)..."
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Internal Pharmacy Remarks (Optional)
            </label>
            <input
              type="text"
              value={newForm.remarks}
              onChange={(e) => setNewForm({ ...newForm, remarks: e.target.value })}
              placeholder="e.g. Patient waiting in lounge..."
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setRxPreview(null);
                setIsNewModalOpen(false);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Send Clarification'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
