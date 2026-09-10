import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { couponsApi } from '../../api';
import {
  Ticket,
  Percent,
  IndianRupee,
  Copy,
  Check,
  User,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  ArrowRight,
  Loader2
} from 'lucide-react';

export const CouponDetailsModal = ({ isOpen, onClose, couponId }) => {
  const [currentCouponId, setCurrentCouponId] = useState(couponId);
  const [coupon, setCoupon] = useState(null);
  const [patientWallet, setPatientWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCurrentCouponId(couponId);
  }, [couponId]);

  useEffect(() => {
    if (isOpen && currentCouponId) {
      setLoading(true);
      couponsApi.getCouponById(currentCouponId)
        .then(async (res) => {
          if (res.success && res.data) {
            setCoupon(res.data);
            // Fetch patient's entire referral coupon wallet
            if (res.data.referring_patient_id) {
              try {
                const walletRes = await couponsApi.getPatientCoupons(res.data.referring_patient_id);
                if (walletRes.success && walletRes.data) {
                  setPatientWallet(walletRes.data);
                }
              } catch (wErr) {
                console.warn('Failed to fetch patient wallet:', wErr);
              }
            }
          }
        })
        .catch((err) => console.error('Failed to fetch coupon details:', err))
        .finally(() => setLoading(false));
    } else {
      setCoupon(null);
      setPatientWallet(null);
    }
  }, [isOpen, currentCouponId]);

  const handleCopyCode = (codeToCopy = null) => {
    const code = codeToCopy || coupon?.coupon_code;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (val) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val).split('T')[0];
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(val).split('T')[0];
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      active: { label: 'AVAILABLE / ACTIVE', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
      inactive: { label: 'INACTIVE', bg: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
      redeemed: { label: 'REDEEMED', bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
      expired: { label: 'EXPIRED', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
      cancelled: { label: 'CANCELLED', bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
    };
    const c = config[status] || config.inactive;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border uppercase tracking-wider ${c.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {c.label}
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={coupon ? `Coupon: ${coupon.coupon_code}` : 'Coupon Details'}
      maxWidth="max-w-3xl"
    >
      {loading || !coupon ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading coupon details & wallet...</span>
        </div>
      ) : (
        <div className="space-y-5 text-xs text-slate-700 max-h-[78vh] overflow-y-auto pr-1">
          {/* Header Card */}
          <div className="p-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white rounded-2xl border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-black text-blue-950 tracking-wider">
                  {coupon.coupon_code}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(coupon.coupon_code)}
                  className="p-1 hover:bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 transition-colors"
                  title="Copy coupon code"
                >
                  {copied === coupon.coupon_code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Created on {formatDate(coupon.created_at)} by {coupon.created_by_name || 'System Admin'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getStatusBadge(coupon.status)}
            </div>
          </div>

          {/* Referral Linkage Visual */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
              Referral Relationship
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-7 items-center gap-2 pt-1">
              {/* Referring Patient */}
              <div className="sm:col-span-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                  Referring Patient (Owner)
                </div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {coupon.referring_patient_name}
                </div>
                <div className="text-[11px] text-slate-500">
                  UHID: {coupon.referring_patient_uhid} • 📱 {coupon.referring_patient_mobile}
                </div>
              </div>

              {/* Arrow */}
              <div className="sm:col-span-1 flex justify-center py-1">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* Referred Patient */}
              <div className="sm:col-span-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  Referred Patient
                </div>
                {coupon.referred_patient_name ? (
                  <>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                      {coupon.referred_patient_name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      UHID: {coupon.referred_patient_uhid} • 📱 {coupon.referred_patient_mobile}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400 italic text-[11px] mt-1">
                    Open referral (Not restricted to a single patient)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Discount & Validity Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Discount Type
              </span>
              <span className="font-bold text-slate-900 text-sm capitalize mt-0.5 block">
                {coupon.discount_type} Discount
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Discount Value
              </span>
              <span className="font-bold text-blue-700 text-sm mt-0.5 block">
                {coupon.discount_type === 'percentage'
                  ? `${coupon.discount_value}%`
                  : `₹${parseFloat(coupon.discount_value).toLocaleString('en-IN')}`}
                {coupon.max_discount_limit && (
                  <span className="text-[10px] font-medium text-slate-500 ml-1">
                    (Max ₹{coupon.max_discount_limit})
                  </span>
                )}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Valid From
              </span>
              <span className="font-medium text-slate-800 text-xs mt-0.5 block">
                {formatDate(coupon.valid_from)}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Valid Until
              </span>
              <span className="font-medium text-slate-800 text-xs mt-0.5 block">
                {formatDate(coupon.valid_until)}
              </span>
            </div>
          </div>

          {/* Patient Referral Wallet (All Coupons owned by Patient A) */}
          {patientWallet && patientWallet.coupons && (
            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {patientWallet.patient.full_name}'s Referral Wallet ({patientWallet.coupons.length} Total)
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Chronological history of all referral coupons owned by this patient (latest created first)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {patientWallet.stats.active_eligible_coupons} Active
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                    {patientWallet.stats.redeemed_coupons} Redeemed
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 divide-y divide-slate-100">
                {patientWallet.coupons.map((c, idx) => {
                  const isCurrent = c.id === coupon.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setCurrentCouponId(c.id)}
                      className={`p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent 
                          ? 'bg-blue-50/90 border border-blue-300 ring-2 ring-blue-500/20 shadow-xs' 
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono font-bold text-slate-400 w-5">
                          #{patientWallet.coupons.length - idx}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-blue-900 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                              {c.coupon_code}
                            </span>
                            <span className="font-bold text-slate-800 text-xs">
                              {c.discount_type === 'percentage' ? `${c.discount_value}%` : `₹${parseFloat(c.discount_value).toLocaleString('en-IN')}`}
                            </span>
                            {getStatusBadge(c.status)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Referred: <span className="font-semibold text-slate-700">{c.referred_patient_name || 'Open Referral'}</span>
                            <span className="mx-1.5 text-slate-300">•</span>
                            <span>Created: {formatDate(c.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isCurrent ? (
                          <span className="text-[10px] font-black text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Viewing Now
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 hover:text-blue-600">
                            Click to View →
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Remarks */}
          {coupon.remarks && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Admin Remarks
              </span>
              <p className="text-xs text-slate-700 italic">"{coupon.remarks}"</p>
            </div>
          )}

          {/* Redemption Audit Trail */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>Redemption Audit Details ({coupon.redemptions?.length || 0})</span>
            </h4>

            {!coupon.redemptions || coupon.redemptions.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs italic">
                This coupon has not been redeemed yet (Status: {coupon.status}).
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Redeemed At</th>
                      <th className="p-2.5">Patient</th>
                      <th className="p-2.5">Bill Invoice</th>
                      <th className="p-2.5 text-right">Bill Amt</th>
                      <th className="p-2.5 text-right">Discount</th>
                      <th className="p-2.5 text-right">Final Payable</th>
                      <th className="p-2.5">Staff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {coupon.redemptions.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-600">
                          {formatDate(r.redeemed_at)}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {r.patient_name || `Patient #${r.patient_id}`}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 font-bold">
                          {r.bill_id ? `BILL #${r.bill_id}` : 'Counter Bill'}
                        </td>
                        <td className="p-2.5 text-right text-slate-700 font-mono">
                          ₹{parseFloat(r.bill_amount).toLocaleString('en-IN')}
                        </td>
                        <td className="p-2.5 text-right font-bold text-emerald-600 font-mono">
                          -₹{parseFloat(r.discount_amount).toLocaleString('en-IN')}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900 font-mono">
                          ₹{parseFloat(r.final_payable).toLocaleString('en-IN')}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {r.redeemed_by_user_name || 'Staff'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
