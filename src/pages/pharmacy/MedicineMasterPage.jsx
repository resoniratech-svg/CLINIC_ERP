import React, { useEffect, useState } from 'react';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import { Pill, Plus, Search, AlertCircle, CheckCircle2, Edit3, Eye, Check, X, Package, ShieldCheck } from 'lucide-react';

export const MedicineMasterPage = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Add Medicine Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    medicine_name: '',
    strength: '',
    quantity: '',
  });
  const [nextSerial, setNextSerial] = useState('');
  const [loadingSerial, setLoadingSerial] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);

  const handleOpenAddModal = async () => {
    setFormData({
      medicine_name: '',
      strength: '',
      quantity: '',
    });
    setNextSerial('Loading...');
    setLoadingSerial(true);
    setIsAddModalOpen(true);
    try {
      const res = await pharmacyApi.getNextMedicineSerial();
      if (res.success && res.data?.serial_number) {
        setNextSerial(res.data.serial_number);
      } else {
        setNextSerial('AUTOMATICALLY GENERATED');
      }
    } catch (e) {
      setNextSerial('AUTOMATICALLY GENERATED');
    } finally {
      setLoadingSerial(false);
    }
  };

  // Edit Medicine Modal
  const [editingMed, setEditingMed] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // View Details Modal
  const [viewingMed, setViewingMed] = useState(null);
  const [stockDetail, setStockDetail] = useState(null);
  const [loadingStock, setLoadingStock] = useState(false);

  const { showToast } = useToast();

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;

      const res = await pharmacyApi.getMedicines(params);
      if (res.success) {
        setMedicines(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch formulary catalog', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMedicines();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, categoryFilter]);

  // Handle Add Medicine Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.medicine_name.trim()) {
      showToast('Medicine Name is required', 'warning');
      return;
    }
    if (!formData.strength.trim()) {
      showToast('Potency / Strength is required', 'warning');
      return;
    }
    if (formData.quantity !== '' && parseInt(formData.quantity) < 0) {
      showToast('Quantity cannot be negative', 'warning');
      return;
    }

    setSavingAdd(true);
    try {
      const res = await pharmacyApi.createMedicine({
        medicine_name: formData.medicine_name.trim(),
        strength: formData.strength.trim(),
        quantity: formData.quantity !== '' ? parseInt(formData.quantity) : undefined,
      });

      if (res.success) {
        showToast(`Medicine added to formulary: ${res.data?.serial_number || res.data?.medicine_name}`, 'success');
        setIsAddModalOpen(false);
        setFormData({
          medicine_name: '',
          strength: '',
          quantity: '',
        });
        fetchMedicines();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create medicine', 'error');
    } finally {
      setSavingAdd(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (med) => {
    setEditingMed(med);
    setEditFormData({
      medicine_name: med.medicine_name || '',
      generic_name: med.generic_name || '',
      medicine_type: med.medicine_type || 'dilution',
      strength: med.strength || '',
      unit: med.unit || 'pcs',
      category: med.category || 'General',
      manufacturer: med.manufacturer || '',
      reorder_level: med.reorder_level || 10,
      status: med.status || 'active',
    });
  };

  // Handle Edit Medicine Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingMed || !editFormData.medicine_name.trim()) return;

    setSavingEdit(true);
    try {
      const res = await pharmacyApi.updateMedicine(editingMed.id, {
        ...editFormData,
        reorder_level: parseInt(editFormData.reorder_level) || 10,
      });

      if (res.success) {
        showToast('Medicine details updated successfully', 'success');
        setEditingMed(null);
        fetchMedicines();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update medicine', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async (med) => {
    const newStatus = med.status === 'active' ? 'inactive' : 'active';
    const confirmMsg = `Are you sure you want to mark ${med.medicine_name} as ${newStatus.toUpperCase()}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await pharmacyApi.updateMedicine(med.id, { status: newStatus });
      if (res.success) {
        showToast(`Medicine marked as ${newStatus}`, 'success');
        fetchMedicines();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // View Medicine & Stock Details
  const handleViewDetails = async (med) => {
    setViewingMed(med);
    setLoadingStock(true);
    setStockDetail(null);
    try {
      const res = await pharmacyApi.getMedicineStockDetail(med.id);
      if (res.success) {
        setStockDetail(res.data);
      }
    } catch (err) {
      // Stock details optional
    } finally {
      setLoadingStock(false);
    }
  };

  // Extract unique categories from current medicines for filter dropdown
  const uniqueCategories = Array.from(new Set(medicines.map((m) => m.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Pill className="w-5 h-5 text-red-600" />
            <span>Pharmacy Formulary & Medicine Master</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Super Admin catalog governance: homeopathic dilutions, mother tinctures, potencies, and minimum reorder thresholds
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Medicine</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search formulary by brand, remedy name, or generic name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {uniqueCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">All Categories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading pharmacy catalog..." />
        ) : medicines.length === 0 ? (
          <EmptyState
            title="No medicines found in formulary"
            description="Add remedies using the button above or adjust your search / status filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Medicine Name</th>
                  <th className="py-3 px-4">Generic / Salt</th>
                  <th className="py-3 px-4">Potency / Strength</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Manufacturer</th>
                  <th className="py-3 px-4">Reorder Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {medicines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{m.medicine_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                        {m.serial_number && (
                          <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            {m.serial_number}
                          </span>
                        )}
                        <span>ID #{m.id}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{m.generic_name || '—'}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-blue-700">{m.strength || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-600">{m.category || 'General'}</td>
                    <td className="py-3.5 px-4 text-slate-600">{m.manufacturer || '—'}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {m.reorder_level} {m.unit || 'unit'}s
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(m)}
                        title="Click to toggle active/inactive status"
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                          m.status === 'active'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        {m.status || 'active'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(m)}
                          title="View Details & Batch Stock"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(m)}
                          title="Edit Formulary Item"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
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

      {/* Modal: Add Medicine to Pharmacy Formulary */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Medicine to Pharmacy Formulary"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Medicine Name *
            </label>
            <input
              type="text"
              required
              value={formData.medicine_name}
              onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
              placeholder="e.g. Arnica Montana"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Potency / Strength *
            </label>
            <input
              type="text"
              required
              value={formData.strength}
              onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
              placeholder="e.g. 30C, 200C, 1M, Q"
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Quantity (Optional)
            </label>
            <input
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              placeholder="e.g. 100 (leave empty if no initial stock)"
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Serial Number
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={nextSerial || 'AUTOMATICALLY GENERATED'}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed select-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              AUTOMATICALLY GENERATED — READ ONLY
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingAdd}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingAdd ? 'Saving to Formulary...' : 'Save to Formulary'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Medicine */}
      <Modal
        isOpen={!!editingMed}
        onClose={() => setEditingMed(null)}
        title={`Edit Formulary Item: ${editingMed?.medicine_name}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Medicine Name *</label>
            <input
              type="text"
              required
              value={editFormData.medicine_name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, medicine_name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Generic / Scientific Name</label>
            <input
              type="text"
              value={editFormData.generic_name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, generic_name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Potency / Strength</label>
              <input
                type="text"
                value={editFormData.strength || ''}
                onChange={(e) => setEditFormData({ ...editFormData, strength: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Dispensing Unit</label>
              <input
                type="text"
                value={editFormData.unit || ''}
                onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Category</label>
              <input
                type="text"
                value={editFormData.category || ''}
                onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Reorder Threshold</label>
              <input
                type="number"
                value={editFormData.reorder_level || ''}
                onChange={(e) => setEditFormData({ ...editFormData, reorder_level: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Manufacturer</label>
              <input
                type="text"
                value={editFormData.manufacturer || ''}
                onChange={(e) => setEditFormData({ ...editFormData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Status</label>
              <select
                value={editFormData.status || 'active'}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setEditingMed(null)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingEdit ? 'Saving...' : 'Update Formulary Item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Details & Live Stock */}
      <Modal
        isOpen={!!viewingMed}
        onClose={() => setViewingMed(null)}
        title={`Formulary Details: ${viewingMed?.medicine_name}`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Medicine Name</span>
              <div className="font-bold text-slate-900 text-sm">{viewingMed?.medicine_name}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Serial Number</span>
              <div className="font-mono font-bold text-blue-700">{viewingMed?.serial_number || `MED-${String(viewingMed?.id || 0).padStart(5, '0')}`}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Generic / Scientific</span>
              <div className="font-semibold text-slate-800">{viewingMed?.generic_name || '—'}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Strength / Potency</span>
              <div className="font-mono font-bold text-blue-700">{viewingMed?.strength || '—'}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Category</span>
              <div className="font-medium text-slate-700">{viewingMed?.category || 'General'}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Manufacturer</span>
              <div className="font-medium text-slate-700">{viewingMed?.manufacturer || '—'}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Reorder Threshold</span>
              <div className="font-mono font-bold text-slate-900">{viewingMed?.reorder_level} {viewingMed?.unit}s</div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span>Current Branch Stock & Batch Breakdown</span>
            </h4>

            {loadingStock ? (
              <div className="py-6 text-center text-slate-400">Loading live batch stock...</div>
            ) : !stockDetail?.batches || stockDetail.batches.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-800 text-center">
                No active inventory batches recorded for this medicine in current branch.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-2 px-3">Batch Number</th>
                      <th className="py-2 px-3">Quantity</th>
                      <th className="py-2 px-3">Expiry Date</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockDetail.batches.map((b) => (
                      <tr key={b.id || b.batch_number}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{b.batch_number}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{b.quantity}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            b.quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {b.quantity > 0 ? 'In Stock' : 'Depleted'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setViewingMed(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MedicineMasterPage;
