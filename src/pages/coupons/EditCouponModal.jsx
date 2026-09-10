import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { couponsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Edit3, Loader2 } from 'lucide-react';

export const EditCouponModal = ({ isOpen, onClose, coupon, onCouponUpdated }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    valid_until: '',
    status: 'active',
    max_discount_limit: '',
    remarks: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (coupon) {
      setFormData({
        valid_until: coupon.valid_until || '',
        status: coupon.status || 'active',
        max_discount_limit: coupon.max_discount_limit !== null ? String(coupon.max_discount_limit) : '',
        remarks: coupon.remarks || '',
      });
    }
  }, [coupon]);

  if (!coupon) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.valid_until) {
      showToast('Valid Until date is required', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        valid_until: formData.valid_until,
        status: formData.status,
        max_discount_limit: formData.max_discount_limit ? parseFloat(formData.max_discount_limit) : null,
        remarks: formData.remarks.trim() || null,
      };

      const res = await couponsApi.updateCoupon(coupon.id, payload);
      if (res.success) {
        showToast(`Coupon ${coupon.coupon_code} updated successfully`, 'success');
        if (onCouponUpdated) onCouponUpdated();
        onClose();
      }
    } catch (err) {
      console.error('Failed to update coupon:', err);
      showToast(err.message || 'Failed to update coupon', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isRedeemed = coupon.status === 'redeemed';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Coupon: ${coupon.coupon_code}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
        {isRedeemed && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 text-xs font-semibold">
            ⚠ This coupon has already been redeemed. Its terms are locked and cannot be edited.
          </div>
        )}

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Owner</span>
            <span className="font-bold text-slate-900">{coupon.referring_patient_name}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Discount</span>
            <span className="font-bold text-blue-700">
              {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Valid Until (Expiry) *</label>
            <input
              type="date"
              disabled={isRedeemed}
              required
              value={formData.valid_until}
              onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status</label>
            <select
              disabled={isRedeemed}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 font-semibold"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="cancelled">Cancelled</option>
              {isRedeemed && <option value="redeemed">Redeemed</option>}
            </select>
          </div>
        </div>

        {coupon.discount_type === 'percentage' && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Max Discount Cap (₹) — Optional
            </label>
            <input
              type="number"
              disabled={isRedeemed}
              placeholder="Leave empty for uncapped"
              value={formData.max_discount_limit}
              onChange={(e) => setFormData({ ...formData, max_discount_limit: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Admin Remarks</label>
          <textarea
            rows={3}
            disabled={isRedeemed}
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 resize-none"
          />
        </div>

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
            disabled={loading || isRedeemed}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
