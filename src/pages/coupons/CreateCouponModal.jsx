import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { couponsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import {
  Ticket,
  Percent,
  IndianRupee,
  Sparkles,
  Search,
  Check,
  Copy,
  Loader2,
  AlertCircle,
  UserCheck,
  Calendar,
  FileText
} from 'lucide-react';

export const CreateCouponModal = ({ isOpen, onClose, onCouponCreated }) => {
  const { showToast } = useToast();

  // Form State
  const [formData, setFormData] = useState({
    coupon_code: '',
    discount_type: 'percentage',
    discount_value: '10',
    max_discount_limit: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    remarks: '',
  });

  // Selected Patients
  const [referringPatient, setReferringPatient] = useState(null);
  const [referredPatient, setReferredPatient] = useState(null);

  // Search Autocomplete States
  const [refSearch, setRefSearch] = useState('');
  const [refResults, setRefResults] = useState([]);
  const [refSearching, setRefSearching] = useState(false);
  const [showRefDropdown, setShowRefDropdown] = useState(false);

  const [tgtSearch, setTgtSearch] = useState('');
  const [tgtResults, setTgtResults] = useState([]);
  const [tgtSearching, setTgtSearching] = useState(false);
  const [showTgtDropdown, setShowTgtDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [createdCoupon, setCreatedCoupon] = useState(null);
  const [copied, setCopied] = useState(false);

  const refDropdownRef = useRef(null);
  const tgtDropdownRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFormData({
        coupon_code: '',
        discount_type: 'percentage',
        discount_value: '10',
        max_discount_limit: '',
        valid_from: today,
        valid_until: thirtyDays,
        remarks: '',
      });
      setReferringPatient(null);
      setReferredPatient(null);
      setRefSearch('');
      setTgtSearch('');
      setCreatedCoupon(null);
      setCopied(false);
      // Auto-generate initial code
      handleAutoGenerateCode();
    }
  }, [isOpen]);

  // Click outside listener for autocomplete dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (refDropdownRef.current && !refDropdownRef.current.contains(e.target)) {
        setShowRefDropdown(false);
      }
      if (tgtDropdownRef.current && !tgtDropdownRef.current.contains(e.target)) {
        setShowTgtDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for Referring Patient
  useEffect(() => {
    if (!refSearch.trim() || refSearch.length < 2) {
      setRefResults([]);
      setShowRefDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setRefSearching(true);
      try {
        const res = await couponsApi.searchPatients({ q: refSearch.trim() });
        if (res.success && Array.isArray(res.data)) {
          setRefResults(res.data);
          setShowRefDropdown(true);
        }
      } catch (err) {
        console.error('Referring patient search error:', err);
      } finally {
        setRefSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [refSearch]);

  // Debounced search for Referred Patient
  useEffect(() => {
    if (!tgtSearch.trim() || tgtSearch.length < 2) {
      setTgtResults([]);
      setShowTgtDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setTgtSearching(true);
      try {
        const res = await couponsApi.searchPatients({ q: tgtSearch.trim() });
        if (res.success && Array.isArray(res.data)) {
          setTgtResults(res.data);
          setShowTgtDropdown(true);
        }
      } catch (err) {
        console.error('Referred patient search error:', err);
      } finally {
        setTgtSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [tgtSearch]);

  const handleAutoGenerateCode = async (patientName = '') => {
    setGeneratingCode(true);
    try {
      const res = await couponsApi.generateCode({ patient_name: patientName || referringPatient?.full_name || '' });
      if (res.success && res.data?.coupon_code) {
        setFormData((prev) => ({ ...prev, coupon_code: res.data.coupon_code }));
      }
    } catch (err) {
      console.error('Failed to generate coupon code:', err);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleSelectReferringPatient = (patient) => {
    setReferringPatient(patient);
    setRefSearch('');
    setShowRefDropdown(false);
    // Regenerate code with patient's name prefix if code was default
    if (!formData.coupon_code || formData.coupon_code.startsWith('REF-')) {
      handleAutoGenerateCode(patient.full_name);
    }
  };

  const handleSelectReferredPatient = (patient) => {
    if (referringPatient && referringPatient.patient_id === patient.patient_id) {
      showToast('Referring patient and referred patient cannot be the same individual', 'error');
      return;
    }
    setReferredPatient(patient);
    setTgtSearch('');
    setShowTgtDropdown(false);
  };

  const handleCopyCode = () => {
    if (!createdCoupon?.coupon_code) return;
    navigator.clipboard.writeText(createdCoupon.coupon_code);
    setCopied(true);
    showToast('Coupon code copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!referringPatient) {
      showToast('Please select the Referring Patient (Coupon Owner)', 'warning');
      return;
    }

    if (referredPatient && referringPatient.patient_id === referredPatient.patient_id) {
      showToast('Referring patient and referred patient cannot be the same individual', 'error');
      return;
    }

    const val = parseFloat(formData.discount_value);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid discount value greater than zero', 'warning');
      return;
    }

    if (formData.discount_type === 'percentage' && val > 100) {
      showToast('Percentage discount cannot exceed 100%', 'warning');
      return;
    }

    if (!formData.valid_until) {
      showToast('Please select a Valid Until expiration date', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        coupon_code: formData.coupon_code.trim(),
        discount_type: formData.discount_type,
        discount_value: val,
        max_discount_limit: formData.max_discount_limit ? parseFloat(formData.max_discount_limit) : null,
        referring_patient_id: referringPatient.patient_id,
        referred_patient_id: referredPatient ? referredPatient.patient_id : null,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until,
        remarks: formData.remarks.trim() || null,
      };

      const res = await couponsApi.createCoupon(payload);
      if (res.success && res.data) {
        setCreatedCoupon(res.data);
        showToast('Coupon created successfully!', 'success');
        if (onCouponCreated) onCouponCreated(res.data);
      }
    } catch (err) {
      console.error('createCoupon error:', err);
      showToast(err.message || 'Failed to create coupon', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Patient Referral Coupon"
      maxWidth="max-w-2xl"
    >
      {createdCoupon ? (
        /* Success Screen with Prominent Code & Copy Button */
        <div className="py-6 px-4 text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800">Coupon Created Successfully!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Referral reward coupon has been issued for{' '}
              <span className="font-semibold text-slate-700">{referringPatient?.full_name}</span>.
            </p>
          </div>

          {/* Prominent Coupon Card */}
          <div className="max-w-md mx-auto p-5 bg-gradient-to-br from-blue-50 to-indigo-50/70 border-2 border-dashed border-blue-300 rounded-2xl relative shadow-xs">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">
              {createdCoupon.discount_type === 'percentage' ? 'Percentage Referral Reward' : 'Cash Discount Reward'}
            </div>
            <div className="font-mono text-2xl font-black text-blue-900 tracking-wider my-2 select-all">
              {createdCoupon.coupon_code}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-700">
              <span>Value:</span>
              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-xs font-bold">
                {createdCoupon.discount_type === 'percentage'
                  ? `${createdCoupon.discount_value}%`
                  : `₹${createdCoupon.discount_value}`}
              </span>
              <span className="text-slate-400">•</span>
              <span>Valid Until:</span>
              <span className="font-medium text-slate-800">{createdCoupon.valid_until}</span>
            </div>

            <button
              onClick={handleCopyCode}
              type="button"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Coupon Code'}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setCreatedCoupon(null);
                setReferringPatient(null);
                setReferredPatient(null);
                handleAutoGenerateCode();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              + Create Another Coupon
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              Done & Close
            </button>
          </div>
        </div>
      ) : (
        /* Create Coupon Form */
        <form onSubmit={handleSubmit} className="space-y-5 text-xs text-slate-700">
          {/* Section 1: Referral Information */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Referral Information
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Referring Patient (Owner) */}
              <div className="relative" ref={refDropdownRef}>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Referring Patient (Coupon Owner) *
                </label>
                {referringPatient ? (
                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-blue-950 text-xs">{referringPatient.full_name}</div>
                      <div className="text-[10px] text-blue-700">
                        UHID: {referringPatient.uhid} • 📱 {referringPatient.mobile_number}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReferringPatient(null)}
                      className="text-[10px] text-red-600 hover:underline font-semibold ml-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search patient by name, mobile, UHID..."
                        value={refSearch}
                        onChange={(e) => setRefSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      {refSearching && (
                        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-3 top-2.5" />
                      )}
                    </div>
                    {showRefDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                        {refResults.length === 0 ? (
                          <div className="p-3 text-[11px] text-slate-400 text-center">No patients found</div>
                        ) : (
                          refResults.map((p) => (
                            <div
                              key={p.patient_id}
                              onClick={() => handleSelectReferringPatient(p)}
                              className="p-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-none cursor-pointer transition-colors"
                            >
                              <div className="font-bold text-slate-800 text-xs">{p.full_name}</div>
                              <div className="text-[10px] text-slate-500">
                                UHID: {p.uhid} • 📱 {p.mobile_number}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 mt-1 block">
                  The existing patient who referred someone and receives this reward.
                </span>
              </div>

              {/* Referred Patient (New Patient) */}
              <div className="relative" ref={tgtDropdownRef}>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Referred Patient (Optional)
                </label>
                {referredPatient ? (
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-emerald-950 text-xs">{referredPatient.full_name}</div>
                      <div className="text-[10px] text-emerald-700">
                        UHID: {referredPatient.uhid} • 📱 {referredPatient.mobile_number}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReferredPatient(null)}
                      className="text-[10px] text-red-600 hover:underline font-semibold ml-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search referred patient (optional)..."
                        value={tgtSearch}
                        onChange={(e) => setTgtSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      {tgtSearching && (
                        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-3 top-2.5" />
                      )}
                    </div>
                    {showTgtDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                        {tgtResults.length === 0 ? (
                          <div className="p-3 text-[11px] text-slate-400 text-center">No patients found</div>
                        ) : (
                          tgtResults.map((p) => (
                            <div
                              key={p.patient_id}
                              onClick={() => handleSelectReferredPatient(p)}
                              className={`p-2.5 border-b border-slate-50 last:border-none cursor-pointer transition-colors ${
                                referringPatient?.patient_id === p.patient_id
                                  ? 'bg-slate-100 opacity-50 cursor-not-allowed'
                                  : 'hover:bg-emerald-50'
                              }`}
                            >
                              <div className="font-bold text-slate-800 text-xs">{p.full_name}</div>
                              <div className="text-[10px] text-slate-500">
                                UHID: {p.uhid} • 📱 {p.mobile_number}
                                {referringPatient?.patient_id === p.patient_id && ' (Same as referring patient)'}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 mt-1 block">
                  The new patient who was referred to the hospital by the owner.
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Coupon Details */}
          <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-200/60 space-y-3">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                2. Coupon Details & Discount
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Coupon Code */}
              <div className="sm:col-span-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">Coupon Code *</label>
                  <button
                    type="button"
                    onClick={() => handleAutoGenerateCode()}
                    disabled={generatingCode}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Regenerate</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formData.coupon_code}
                  onChange={(e) =>
                    setFormData({ ...formData, coupon_code: e.target.value.toUpperCase().replace(/\s+/g, '') })
                  }
                  placeholder="REF-RAVI-8K4P2"
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Discount Type Selector */}
              <div className="sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Discount Type *</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'percentage' })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formData.discount_type === 'percentage'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>Percent</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'cash' })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formData.discount_type === 'cash'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span>Cash</span>
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              <div className="sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Discount Value ({formData.discount_type === 'percentage' ? '%' : '₹'}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">
                    {formData.discount_type === 'percentage' ? '%' : '₹'}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={formData.discount_type === 'percentage' ? '100' : '999999'}
                    required
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder={formData.discount_type === 'percentage' ? '10' : '200'}
                    className="w-full pl-8 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Optional Cap for Percentage */}
            {formData.discount_type === 'percentage' && (
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Maximum Discount Cap (₹) — Optional
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 500 (leave empty for uncapped percentage)"
                  value={formData.max_discount_limit}
                  onChange={(e) => setFormData({ ...formData, max_discount_limit: e.target.value })}
                  className="w-full sm:w-1/2 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Section 3: Validity Period */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                3. Validity & Duration
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Valid From *</label>
                <input
                  type="date"
                  required
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Valid Until (Expiry) *</label>
                <input
                  type="date"
                  required
                  min={formData.valid_from}
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Remarks / Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Admin Remarks / Policy Notes
            </label>
            <textarea
              rows={2}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="e.g. Referral reward for new patient registration from Dombivli branch"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
              <span>Create Coupon</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
