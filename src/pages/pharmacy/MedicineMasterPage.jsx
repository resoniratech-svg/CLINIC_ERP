import React, { useEffect, useState } from 'react';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Pill, Plus, Search, AlertCircle, CheckCircle2, Edit3, Eye, Check, X, Package, ShieldCheck, FileSpreadsheet, UploadCloud, AlertTriangle } from 'lucide-react';

export const MedicineMasterPage = () => {
  const { isSuperAdmin } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Import Medicines Modal (Super Admin Only)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validatingFile, setValidatingFile] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importingMedicines, setImportingMedicines] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = React.useRef(null);

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

  // Import Event Handlers
  const handleOpenImportModal = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
    setSelectedFile(null);
    setPreviewData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (importResult && (importResult.successfully_imported > 0 || importResult.successfully_merged > 0)) {
      fetchMedicines();
    }
    setImportResult(null);
  };

  const handleProcessFile = (file) => {
    if (!file) return;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      showToast('Please select a valid Excel (.xlsx or .xls) file', 'warning');
      return;
    }
    setSelectedFile(file);
    setPreviewData(null);
    setImportResult(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleValidatePreview = async () => {
    if (!selectedFile) {
      showToast('Please select an Excel file to validate', 'warning');
      return;
    }
    setValidatingFile(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      const res = await pharmacyApi.previewMedicineImport(uploadFormData);
      if (res.success) {
        setPreviewData(res.data);
        showToast(`Validation preview ready: ${res.data.valid_rows} item(s) to process`, 'success');
      } else {
        showToast(res.message || 'Validation failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Validation error', 'error');
    } finally {
      setValidatingFile(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || previewData.valid_rows === 0) {
      showToast('No valid rows available to import', 'warning');
      return;
    }
    setImportingMedicines(true);
    try {
      const payload = {
        file_name: previewData.file_name,
        items: previewData.valid_items,
        row_issues: previewData.row_issues,
        duplicate_rows: previewData.duplicate_rows,
        invalid_rows: previewData.invalid_rows
      };
      const res = await pharmacyApi.confirmMedicineImport(payload);
      if (res.success) {
        setImportResult(res.data);
        const importedCount = res.data.successfully_imported || 0;
        const mergedCount = res.data.successfully_merged || 0;
        showToast(`Import completed: ${importedCount} created, ${mergedCount} merged`, 'success');
      } else {
        showToast(res.message || 'Import failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Import error', 'error');
    } finally {
      setImportingMedicines(false);
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
  }, [searchTerm, statusFilter]);

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
        showToast(res.message || `Medicine added to formulary: ${res.data?.serial_number || res.data?.medicine_name}`, 'success');
        setIsAddModalOpen(false);
        setFormData({
          medicine_name: '',
          strength: '',
          quantity: '',
        });
        fetchMedicines();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to create medicine', 'error');
    } finally {
      setSavingAdd(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (med) => {
    setEditingMed(med);
    setEditFormData({
      medicine_name: med.medicine_name || '',
      strength: med.strength || '',
      quantity: med.quantity !== null && med.quantity !== undefined ? med.quantity : '',
      serial_number: med.serial_number || `MED-${String(med.id).padStart(5, '0')}`,
    });
  };

  // Handle Edit Medicine Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingMed || !editFormData.medicine_name.trim()) {
      showToast('Medicine Name is required', 'warning');
      return;
    }
    if (!editFormData.strength.trim()) {
      showToast('Potency / Strength is required', 'warning');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await pharmacyApi.updateMedicine(editingMed.id, {
        medicine_name: editFormData.medicine_name.trim(),
        strength: editFormData.strength.trim(),
        quantity: editFormData.quantity !== '' ? parseInt(editFormData.quantity, 10) : undefined,
      });

      if (res.success) {
        showToast(res.message || 'Medicine details updated successfully', 'success');
        setEditingMed(null);
        fetchMedicines();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to update medicine', 'error');
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
            Super Admin catalog governance: standardized homeopathic remedies, potencies, serial identifiers, and inventory stock
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button
              onClick={handleOpenImportModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import Medicines</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Medicine</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search formulary by serial number, medicine name, or potency..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
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
                  <th className="py-3.5 px-4">Serial Number</th>
                  <th className="py-3.5 px-4">Medicine Name</th>
                  <th className="py-3.5 px-4">Potency / Strength</th>
                  <th className="py-3.5 px-4">Quantity</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {medicines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold">
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 text-xs inline-block">
                        {m.serial_number || `MED-${String(m.id).padStart(5, '0')}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{m.medicine_name}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                      {m.strength || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {m.quantity !== null && m.quantity !== undefined ? (
                        <span>{m.quantity}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(m)}
                          title="View Details"
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

      {/* Modal: Import Medicines (Super Admin) */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={handleCloseImportModal}
        title="Import Medicines to Pharmacy Formulary"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs text-slate-700">
          {!importResult ? (
            <>
              {/* File Selector */}
              <div>
                <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                  Choose Excel File (.xlsx / .xls) *
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handleProcessFile(file);
                  }}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-5 text-center transition-colors bg-slate-50/50"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="medicine-excel-upload"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="medicine-excel-upload"
                    className="cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-9 h-9 text-emerald-600" />
                    <div>
                      <span className="font-bold text-blue-600 hover:underline">Click to browse</span>
                      <span className="text-slate-500"> or drag and drop your Excel file here</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Supported formats: .xlsx, .xls</p>
                  </label>
                </div>

                {selectedFile && (
                  <div className="mt-2.5 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5 truncate">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-emerald-950 truncate text-xs">{selectedFile.name}</span>
                      <span className="text-[10px] text-emerald-700 font-medium">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-lg cursor-pointer transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Section */}
              {previewData && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Validation & Preview Results
                  </div>

                  {/* Detected Columns */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1.5">
                    <span className="font-bold text-slate-700 block uppercase text-[10px]">Detected Columns:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Name: <strong className="text-slate-800">{previewData.detected_columns?.medicine_name}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Potency: <strong className="text-slate-800">{previewData.detected_columns?.potency}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {previewData.detected_columns?.serial ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Sl.No: <strong className="text-slate-800">{previewData.detected_columns?.serial}</strong></span>
                          </>
                        ) : (
                          <>
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                            <span className="text-slate-400">Sl.No: None</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {previewData.detected_columns?.quantity ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Qty: <strong className="text-slate-800">{previewData.detected_columns?.quantity}</strong></span>
                          </>
                        ) : (
                          <>
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                            <span className="text-slate-400">Qty: None</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary Counters */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Total Rows</div>
                      <div className="text-base font-extrabold text-slate-800">{previewData.total_rows}</div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                      <div className="text-[10px] uppercase font-bold text-emerald-600">New Items</div>
                      <div className="text-base font-extrabold text-emerald-700">{previewData.new_items_count ?? previewData.valid_rows}</div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/60">
                      <div className="text-[10px] uppercase font-bold text-blue-600">Merged / Stock</div>
                      <div className="text-base font-extrabold text-blue-700">{previewData.merged_count ?? previewData.duplicate_rows}</div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-red-200 bg-red-50/60">
                      <div className="text-[10px] uppercase font-bold text-red-600">Invalid</div>
                      <div className="text-base font-extrabold text-red-700">{previewData.invalid_rows}</div>
                    </div>
                  </div>

                  {/* Row Issues Breakdown */}
                  {previewData.row_issues && previewData.row_issues.length > 0 && (
                    <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px] mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Notices & Issues ({previewData.row_issues.length}):</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                        {previewData.row_issues.map((issue, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-2 p-2 bg-white rounded-lg border border-amber-100 shadow-2xs">
                            <div className="truncate">
                              <span className="font-bold text-slate-700">Row {issue.row}: </span>
                              <span className="text-slate-900 font-semibold">{issue.medicine_name || '(empty name)'} </span>
                              <span className="text-slate-500 font-mono text-[10px]">({issue.potency || 'no potency'})</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              issue.status === 'will_merge'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : issue.status === 'duplicate' 
                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {issue.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseImportModal}
                  disabled={validatingFile || importingMedicines}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                {!previewData ? (
                  <button
                    type="button"
                    onClick={handleValidatePreview}
                    disabled={!selectedFile || validatingFile}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {validatingFile ? <LoadingSpinner size="sm" /> : <UploadCloud className="w-4 h-4" />}
                    <span>{validatingFile ? 'Validating...' : 'Validate / Preview'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={previewData.valid_rows === 0 || importingMedicines}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {importingMedicines ? <LoadingSpinner size="sm" /> : <Check className="w-4 h-4" />}
                    <span>
                      {importingMedicines 
                        ? 'Importing Medicines...' 
                        : `Import Valid Medicines (${previewData.valid_rows})`}
                    </span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Result Summary View */
            <div className="space-y-4 py-1">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-emerald-950 text-sm">Import Completed Successfully</div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    Formulary catalog updated. New medicines assigned unique serial numbers, existing medicines consolidated with incoming stock.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Successfully Created</div>
                  <div className="text-lg font-extrabold text-emerald-800">{importResult.successfully_imported}</div>
                </div>
                <div className="p-3 rounded-xl border border-blue-200 bg-blue-50">
                  <div className="text-[10px] uppercase font-bold text-blue-700">Merged / Added Stock</div>
                  <div className="text-lg font-extrabold text-blue-800">{importResult.successfully_merged ?? 0}</div>
                </div>
                <div className="p-3 rounded-xl border border-red-200 bg-red-50">
                  <div className="text-[10px] uppercase font-bold text-red-700">Invalid Rows</div>
                  <div className="text-lg font-extrabold text-red-800">{importResult.invalid_rows}</div>
                </div>
              </div>

              {importResult.details && importResult.details.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  <span className="font-bold text-slate-800 text-[11px] block mb-2">Imported / Processed Details:</span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                    {importResult.details.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          {item.serial_number && (
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[10px]">
                              {item.serial_number}
                            </span>
                          )}
                          <span className="font-bold text-slate-800">{item.medicine_name}</span>
                          <span className="text-slate-500 font-mono text-[10px]">({item.potency || item.strength})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'imported' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          item.status === 'merged' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          item.status === 'skipped' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {item.status === 'imported' ? 'Created (New)' :
                           item.status === 'merged' ? 'Merged (+ Stock)' :
                           item.status === 'skipped' ? 'Skipped' : item.reason || item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseImportModal}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
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
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Medicine Name *
            </label>
            <input
              type="text"
              required
              value={editFormData.medicine_name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, medicine_name: e.target.value })}
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
              value={editFormData.strength || ''}
              onChange={(e) => setEditFormData({ ...editFormData, strength: e.target.value })}
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
              value={editFormData.quantity ?? ''}
              onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
              placeholder="e.g. 100"
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
              value={editFormData.serial_number || ''}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed select-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              AUTOMATICALLY GENERATED — READ ONLY
            </p>
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
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingEdit ? 'Saving Changes...' : 'Save Changes'}
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
              <div className="font-mono font-bold text-blue-700">
                {viewingMed?.serial_number || `MED-${String(viewingMed?.id || 0).padStart(5, '0')}`}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Strength / Potency</span>
              <div className="font-mono font-bold text-slate-800">{viewingMed?.strength || '—'}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Stock Quantity</span>
              <div className="font-mono font-bold text-slate-900 text-sm">
                {viewingMed?.quantity !== null && viewingMed?.quantity !== undefined ? viewingMed.quantity : '—'}
              </div>
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
