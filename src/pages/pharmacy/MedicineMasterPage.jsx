import React, { useEffect, useState } from 'react';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { Pill, Plus, Search, AlertCircle, CheckCircle2 } from 'lucide-react';

export const MedicineMasterPage = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Medicine Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    medicine_name: '',
    generic_name: '',
    medicine_type: 'dilution',
    strength: '30C',
    unit: 'bottle',
    category: 'Homeopathic Dilution',
    manufacturer: 'Dr. Reckeweg',
    reorder_level: 20,
  });
  const [saving, setSaving] = useState(false);

  const { showToast } = useToast();

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const res = await pharmacyApi.getMedicines({ search: searchTerm });
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
    fetchMedicines();
  }, [searchTerm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.medicine_name) return;

    setSaving(true);
    try {
      const res = await pharmacyApi.createMedicine({
        ...formData,
        reorder_level: parseInt(formData.reorder_level) || 10,
      });

      if (res.success) {
        showToast('Medicine added to master catalog', 'success');
        setIsModalOpen(false);
        setFormData({
          medicine_name: '',
          generic_name: '',
          medicine_type: 'dilution',
          strength: '30C',
          unit: 'bottle',
          category: 'Homeopathic Dilution',
          manufacturer: 'Dr. Reckeweg',
          reorder_level: 20,
        });
        fetchMedicines();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create medicine', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Pill className="w-5 h-5 text-red-600" />
            <span>Pharmacy Formulary & Medicine Master</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Standard homeopathic potencies, dilutions, mother tinctures, and inventory reorder levels
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Medicine</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog by brand, remedy name, or strength..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading pharmacy catalog..." />
        ) : medicines.length === 0 ? (
          <EmptyState
            title="No medicines found"
            description="Add remedies using the button above or adjust your search filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Medicine Name</th>
                  <th className="py-3 px-4">Potency / Strength</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Manufacturer</th>
                  <th className="py-3 px-4">Reorder Level</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {medicines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{m.medicine_name}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-blue-700">{m.strength}</td>
                    <td className="py-3.5 px-4 text-slate-600">{m.category}</td>
                    <td className="py-3.5 px-4 text-slate-600">{m.manufacturer || '—'}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{m.reorder_level} {m.unit}s</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                        {m.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Medicine */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Medicine to Pharmacy Formulary"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Medicine Name *</label>
            <input
              type="text"
              required
              value={formData.medicine_name}
              onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
              placeholder="e.g. Arnica Montana"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Potency / Strength</label>
              <input
                type="text"
                value={formData.strength}
                onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                placeholder="e.g. 200C"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Dispensing Unit</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g. bottle"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Reorder Threshold</label>
              <input
                type="number"
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Manufacturer</label>
            <input
              type="text"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Adding...' : 'Save to Formulary'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
