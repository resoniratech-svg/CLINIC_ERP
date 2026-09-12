import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Package,
  Pill,
  AlertTriangle,
  CheckCircle2,
  Plus,
  UploadCloud,
  Download,
  Search,
  Edit2,
  Edit3,
  RefreshCw,
  Eye,
  Clock
} from 'lucide-react';

export const PharmacyInventoryHubPage = () => {
  const { tab } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const activeTab = tab || 'medicines';
  const isImportTab = activeTab === 'import-excel' || activeTab === 'import';

  // Common states
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // 1. Medicines Master state
  const [medicines, setMedicines] = useState([]);
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [medFormData, setMedFormData] = useState({
    medicine_name: '',
    strength: '',
    quantity: '',
  });
  const [nextSerial, setNextSerial] = useState('');
  const [loadingSerial, setLoadingSerial] = useState(false);
  const [savingMed, setSavingMed] = useState(false);

  // Stock Detail Modal state
  const [selectedMedStock, setSelectedMedStock] = useState(null);
  const [loadingStockDetail, setLoadingStockDetail] = useState(false);
  const [isStockDetailModalOpen, setIsStockDetailModalOpen] = useState(false);

  // 2. Stock state
  const [stockList, setStockList] = useState([]);

  // 3. Manual Add Stock Form state
  const [addStockForm, setAddStockForm] = useState({
    medicine_id: searchParams.get('medicine_id') || '',
    batch_number: '',
    manufacture_date: '',
    expiry_date: '',
    quantity: '',
    purchase_rate: '',
    mrp: '',
    supplier: '',
    invoice_number: '',
    remarks: '',
  });
  const [addingStock, setAddingStock] = useState(false);

  // Synchronize medicine_id from URL params whenever searchParams changes
  useEffect(() => {
    const urlMedId = searchParams.get('medicine_id');
    if (urlMedId) {
      setAddStockForm((prev) => ({ ...prev, medicine_id: urlMedId }));
    }
  }, [searchParams]);

  // 4. Excel Import state
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);

  // 5. Stock Alerts state (low-stock, expiring, expired, out-of-stock)
  const [alertStockList, setAlertStockList] = useState([]);

  // Fetch logic based on active tab
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'medicines') {
        const res = await pharmacyApi.getMedicines({ search: search ? search.trim() : undefined });
        if (res.success) setMedicines(res.data || []);
      } else if (activeTab === 'stock') {
        const res = await pharmacyApi.getStock({ search: search ? search.trim() : undefined });
        if (res.success) setStockList(res.data || []);
      } else if (activeTab === 'add-stock') {
        // Pre-fetch medicines list for selector dropdown
        const res = await pharmacyApi.getMedicines();
        if (res.success) setMedicines(res.data || []);
      } else if (activeTab === 'low-stock') {
        const res = await pharmacyApi.getLowStock();
        if (res.success) setAlertStockList(res.data || []);
      } else if (activeTab === 'expiring') {
        const res = await pharmacyApi.getExpiringStock();
        if (res.success) setAlertStockList(res.data || []);
      } else if (activeTab === 'expired') {
        const res = await pharmacyApi.getExpiredStock();
        if (res.success) setAlertStockList(res.data || []);
      } else if (activeTab === 'out-of-stock') {
        const res = await pharmacyApi.getOutOfStock();
        if (res.success) setAlertStockList(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Error loading inventory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search trigger for real-time search filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTab, search]);

  // Handlers for Medicine Master
  const handleOpenMedModal = async (med = null) => {
    if (med) {
      setEditingMed(med);
      setMedFormData({
        medicine_name: med.medicine_name || '',
        strength: med.strength || '',
        quantity: med.quantity !== null && med.quantity !== undefined ? med.quantity : '',
        serial_number: med.serial_number || `MED-${String(med.id).padStart(5, '0')}`,
      });
      setIsMedModalOpen(true);
    } else {
      setEditingMed(null);
      setMedFormData({
        medicine_name: '',
        strength: '',
        quantity: '',
      });
      setNextSerial('Loading...');
      setLoadingSerial(true);
      setIsMedModalOpen(true);
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
    }
  };

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    if (!medFormData.medicine_name.trim()) {
      showToast('Medicine Name is required', 'warning');
      return;
    }
    if (!medFormData.strength.trim()) {
      showToast('Potency / Strength is required', 'warning');
      return;
    }
    if (medFormData.quantity !== '' && parseInt(medFormData.quantity, 10) < 0) {
      showToast('Quantity cannot be negative', 'warning');
      return;
    }

    setSavingMed(true);
    try {
      if (editingMed) {
        const res = await pharmacyApi.updateMedicine(editingMed.id, {
          medicine_name: medFormData.medicine_name.trim(),
          strength: medFormData.strength.trim(),
          quantity: medFormData.quantity !== '' ? parseInt(medFormData.quantity, 10) : undefined,
        });
        if (res.success) {
          showToast(res.message || 'Medicine details updated successfully', 'success');
          setIsMedModalOpen(false);
          setEditingMed(null);
          fetchData();
        } else {
          showToast(res.message || 'Failed to update medicine', 'error');
        }
      } else {
        const res = await pharmacyApi.createMedicine({
          medicine_name: medFormData.medicine_name.trim(),
          strength: medFormData.strength.trim(),
          quantity: medFormData.quantity !== '' ? parseInt(medFormData.quantity, 10) : undefined,
        });
        if (res.success) {
          showToast(res.message || `Medicine added to formulary: ${res.data?.serial_number || res.data?.medicine_name}`, 'success');
          setIsMedModalOpen(false);
          setMedFormData({
            medicine_name: '',
            strength: '',
            quantity: '',
          });
          fetchData();
        } else {
          showToast(res.message || 'Failed to add medicine', 'error');
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to save medicine', 'error');
    } finally {
      setSavingMed(false);
    }
  };

  const handleViewStockDetail = async (med) => {
    setSelectedMedStock({ medicine: med, batches: [] });
    setIsStockDetailModalOpen(true);
    setLoadingStockDetail(true);
    try {
      const res = await pharmacyApi.getMedicineStockDetail(med.id);
      if (res.success) {
        setSelectedMedStock(res.data);
      }
    } catch (err) {
      showToast('Failed to load medicine stock detail', 'error');
    } finally {
      setLoadingStockDetail(false);
    }
  };

  // Handlers for Manual Add Stock
  const handleAddStockSubmit = async (e) => {
    e.preventDefault();
    if (!addStockForm.medicine_id || !addStockForm.batch_number || !addStockForm.expiry_date || !addStockForm.quantity) {
      showToast('Please fill all mandatory fields (Medicine, Batch, Expiry, Quantity)', 'warning');
      return;
    }

    if (addStockForm.manufacture_date && new Date(addStockForm.expiry_date) <= new Date(addStockForm.manufacture_date)) {
      showToast('Expiry date must be strictly after manufacture date', 'warning');
      return;
    }

    setAddingStock(true);
    try {
      const res = await pharmacyApi.addStock({
        medicine_id: parseInt(addStockForm.medicine_id),
        batch_number: addStockForm.batch_number.trim(),
        manufacture_date: addStockForm.manufacture_date || undefined,
        expiry_date: addStockForm.expiry_date,
        quantity: parseInt(addStockForm.quantity),
        purchase_rate: addStockForm.purchase_rate ? parseFloat(addStockForm.purchase_rate) : undefined,
        mrp: addStockForm.mrp ? parseFloat(addStockForm.mrp) : undefined,
        supplier: addStockForm.supplier.trim() || undefined,
        invoice_number: addStockForm.invoice_number.trim() || undefined,
        remarks: addStockForm.remarks.trim() || 'Manual stock receipt',
      });

      if (res.success) {
        showToast('Stock batch successfully added and logged in transaction ledger', 'success');
        setAddStockForm({
          medicine_id: '',
          batch_number: '',
          manufacture_date: '',
          expiry_date: '',
          quantity: '',
          purchase_rate: '',
          mrp: '',
          supplier: '',
          invoice_number: '',
          remarks: '',
        });
        navigate('/pharmacy/inventory/stock');
      } else {
        showToast(res.message || 'Failed to add stock', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error recording stock entry', 'error');
    } finally {
      setAddingStock(false);
    }
  };

  // Handlers for Excel Import
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      parseExcelFile(file);
    }
  };

  const parseExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws);
        setParsedRows(rows);

        // Request preview from backend
        const res = await pharmacyApi.previewStockImport({
          file_name: file.name,
          rows: rows,
        });

        if (res.success) {
          setImportPreview(res.data);
          showToast(`File analyzed: ${res.data.valid_rows} valid, ${res.data.invalid_rows} invalid`, 'info');
        } else {
          showToast(res.message || 'Failed to generate preview', 'error');
        }
      } catch (err) {
        showToast('Failed to parse Excel file. Ensure valid columns.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!parsedRows || parsedRows.length === 0) {
      showToast('No rows to import', 'warning');
      return;
    }

    setImporting(true);
    try {
      const res = await pharmacyApi.confirmStockImport({
        file_name: selectedFile?.name || 'excel_stock_import.xlsx',
        rows: parsedRows,
      });

      if (res.success) {
        showToast('Excel stock batches imported successfully into live database!', 'success');
        setImportPreview(null);
        setSelectedFile(null);
        setParsedRows([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        navigate('/pharmacy/inventory/stock');
      } else {
        showToast(res.message || 'Failed to confirm stock import', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error executing stock import', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Medicine Name': 'Arnica Montana',
        'Potency': '200CH',
        'Unit': 'bottle',
        'Category': 'Homeopathic Dilution',
        'Batch Number': 'ARN-2026-01',
        'Manufacture Date': '2026-01-01',
        'Expiry Date': '2028-12-31',
        'Quantity': 50,
        'Purchase Price': 85.00,
        'MRP': 140.00,
      },
      {
        'Medicine Name': 'Nux Vomica',
        'Potency': '30C',
        'Unit': 'bottle',
        'Category': 'Homeopathic Dilution',
        'Batch Number': 'NUX-2026-02',
        'Manufacture Date': '2026-02-01',
        'Expiry Date': '2028-06-30',
        'Quantity': 30,
        'Purchase Price': 75.00,
        'MRP': 120.00,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'StockTemplate');
    XLSX.writeFile(wb, 'wecare_stock_import_template.xlsx');
    showToast('Sample Excel template downloaded', 'success');
  };

  const tabsList = [
    { id: 'medicines', label: 'Formulary Master', path: '/pharmacy/inventory/medicines' },
    { id: 'stock', label: 'Stock Levels', path: '/pharmacy/inventory/stock' },
    { id: 'add-stock', label: '+ Manual Add Stock', path: '/pharmacy/inventory/add-stock' },
    { id: 'import-excel', label: 'Excel Import', path: '/pharmacy/inventory/import-excel' },
    { id: 'low-stock', label: 'Low Stock Alert', path: '/pharmacy/inventory/low-stock' },
    { id: 'expiring', label: 'Expiring Soon (30d)', path: '/pharmacy/inventory/expiring' },
    { id: 'expired', label: 'Expired Stock', path: '/pharmacy/inventory/expired' },
    { id: 'out-of-stock', label: 'Out of Stock', path: '/pharmacy/inventory/out-of-stock' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pharmacy Inventory & Formulary</h1>
          <p className="text-xs text-slate-500 mt-1">
            Master medicine catalog, batch inventory, FEFO tracking, and Excel stock operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'medicines' && (
            <button
              onClick={() => handleOpenMedModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Medicine</span>
            </button>
          )}
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {tabsList.map((t) => {
          const isActive = activeTab === t.id || (t.id === 'import-excel' && isImportTab);
          return (
            <button
              key={t.id}
              onClick={() => navigate(t.path)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ----------------- TAB 1: MEDICINES MASTER ----------------- */}
      {activeTab === 'medicines' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search catalog by medicine name, generic name, or potency..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : medicines.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Pill}
                  title="No Medicines Found"
                  description="No medicines in the formulary catalog match your search."
                  actionText="Add New Medicine"
                  onAction={() => handleOpenMedModal()}
                />
              </div>
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
                              onClick={() => handleViewStockDetail(m)}
                              title="View Details"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenMedModal(m)}
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
        </div>
      )}

      {/* ----------------- TAB 2: STOCK LEVELS ----------------- */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search stock batches by medicine or batch number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : stockList.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Package}
                  title="No Stock Records"
                  description="No current stock entries found in this branch."
                  actionText="Add Stock Manually"
                  onAction={() => navigate('/pharmacy/inventory/add-stock')}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-4">Batch No</th>
                      <th className="p-4">Medicine & Strength</th>
                      <th className="p-4">Expiry Date</th>
                      <th className="p-4">Quantity Available</th>
                      <th className="p-4">MRP (₹)</th>
                      <th className="p-4">Purchase Rate (₹)</th>
                      <th className="p-4">Supplier / Invoice</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockList.map((s) => {
                      const isExpired = new Date(s.expiry_date) < new Date();
                      const isLow = s.quantity <= (s.reorder_level || 10);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-4 font-bold text-slate-800 font-mono">{s.batch_number}</td>
                          <td className="p-4">
                            <div className="font-bold text-slate-800 text-sm">{s.medicine_name}</div>
                            <div className="text-slate-400 text-2xs">{s.strength || '30C'}</div>
                          </td>
                          <td className="p-4">
                            <span
                              className={`font-semibold ${
                                isExpired ? 'text-red-600 font-bold' : 'text-slate-700'
                              }`}
                            >
                              {s.expiry_date ? new Date(s.expiry_date).toLocaleDateString() : 'N/A'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`text-sm font-bold ${
                                s.quantity === 0
                                  ? 'text-red-600'
                                  : isLow
                                  ? 'text-amber-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {s.quantity}
                            </span>{' '}
                            <span className="text-slate-400 text-2xs">{s.unit || 'units'}</span>
                          </td>
                          <td className="p-4 font-semibold text-slate-800">₹{s.mrp || '0.00'}</td>
                          <td className="p-4 text-slate-600">₹{s.purchase_rate || '0.00'}</td>
                          <td className="p-4 text-slate-500">
                            {s.supplier || '—'}
                            {s.invoice_number && (
                              <span className="block text-2xs text-slate-400">Inv: {s.invoice_number}</span>
                            )}
                          </td>
                          <td className="p-4">
                            {isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-red-100 text-red-800 uppercase">
                                Expired
                              </span>
                            ) : s.quantity === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-red-100 text-red-800 uppercase">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 uppercase">
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 uppercase">
                                Available
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- TAB 3: MANUAL ADD STOCK ----------------- */}
      {activeTab === 'add-stock' && (
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">Manual Stock Receipt</h2>
            <p className="text-xs text-slate-500 mt-1">
              Add a new batch or increase quantity for existing stock. Automatically logs into transaction ledger.
            </p>
          </div>

          <form onSubmit={handleAddStockSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Medicine from Catalog *
              </label>
              <select
                value={addStockForm.medicine_id}
                onChange={(e) => setAddStockForm({ ...addStockForm, medicine_id: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                required
              >
                <option value="">Select Medicine...</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.serial_number || `MED-${String(m.id).padStart(5, '0')}`} — {m.medicine_name} ({m.strength || 'Standard'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Batch Number *
                </label>
                <input
                  type="text"
                  value={addStockForm.batch_number}
                  onChange={(e) => setAddStockForm({ ...addStockForm, batch_number: e.target.value })}
                  placeholder="e.g. BAT-2026-99"
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quantity Received (Units) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={addStockForm.quantity}
                  onChange={(e) => setAddStockForm({ ...addStockForm, quantity: e.target.value })}
                  placeholder="e.g. 50"
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Manufacture Date (Optional)
                </label>
                <input
                  type="date"
                  value={addStockForm.manufacture_date}
                  onChange={(e) => setAddStockForm({ ...addStockForm, manufacture_date: e.target.value })}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Expiry Date *
                </label>
                <input
                  type="date"
                  value={addStockForm.expiry_date}
                  onChange={(e) => setAddStockForm({ ...addStockForm, expiry_date: e.target.value })}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-bold text-red-700"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Purchase Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addStockForm.purchase_rate}
                  onChange={(e) => setAddStockForm({ ...addStockForm, purchase_rate: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  MRP (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addStockForm.mrp}
                  onChange={(e) => setAddStockForm({ ...addStockForm, mrp: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supplier / Vendor Name
                </label>
                <input
                  type="text"
                  value={addStockForm.supplier}
                  onChange={(e) => setAddStockForm({ ...addStockForm, supplier: e.target.value })}
                  placeholder="e.g. Hahnemann Laboratories"
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={addStockForm.invoice_number}
                  onChange={(e) => setAddStockForm({ ...addStockForm, invoice_number: e.target.value })}
                  placeholder="e.g. INV-9842"
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Remarks / Delivery Note
              </label>
              <textarea
                rows="2"
                value={addStockForm.remarks}
                onChange={(e) => setAddStockForm({ ...addStockForm, remarks: e.target.value })}
                placeholder="Optional delivery or storage notes..."
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate('/pharmacy/inventory/stock')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingStock}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {addingStock ? 'Recording Stock...' : 'Save Stock Batch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ----------------- TAB 4: EXCEL IMPORT ----------------- */}
      {isImportTab && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Bulk Excel Stock Batch Import</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Upload an Excel (.xlsx, .xls) spreadsheet to batch-import medicines, stock quantities, and expiry dates.
                </p>
              </div>
              <button
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>
            </div>

            {/* Drop Zone */}
            <div className="mt-6">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
                id="excel-file-upload"
              />
              <label
                htmlFor="excel-file-upload"
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition text-center"
              >
                <UploadCloud className="w-10 h-10 text-blue-600 mb-2" />
                <p className="text-sm font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop Excel file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supported columns: Medicine Name, Potency, Batch Number, Expiry Date, Quantity, MRP, Purchase Price
                </p>
              </label>
            </div>
          </div>

          {/* Import Preview Card */}
          {importPreview && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Import Verification Summary</h3>
                  <p className="text-xs text-slate-500">
                    File: <span className="font-semibold text-slate-700">{importPreview.file_name}</span>
                  </p>
                </div>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing || importPreview.valid_rows === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{importing ? 'Importing...' : `Confirm Import (${importPreview.valid_rows} Valid Rows)`}</span>
                </button>
              </div>

              {/* KPI metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <p className="text-2xs font-bold text-slate-400 uppercase">Total Rows</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{importPreview.total_rows}</p>
                </div>
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <p className="text-2xs font-bold text-emerald-700 uppercase">Valid Rows</p>
                  <p className="text-xl font-bold text-emerald-800 mt-0.5">{importPreview.valid_rows}</p>
                </div>
                <div className="p-3.5 bg-red-50 rounded-xl border border-red-200 text-center">
                  <p className="text-2xs font-bold text-red-700 uppercase">Invalid Rows</p>
                  <p className="text-xl font-bold text-red-800 mt-0.5">{importPreview.invalid_rows}</p>
                </div>
                <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <p className="text-2xs font-bold text-blue-700 uppercase">New Catalog Items</p>
                  <p className="text-xl font-bold text-blue-800 mt-0.5">{importPreview.new_medicines_count}</p>
                </div>
              </div>

              {/* Failed Rows Report */}
              {importPreview.failed_rows_report && importPreview.failed_rows_report.length > 0 && (
                <div className="border border-red-200 bg-red-50/50 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Failed Rows Validation Report ({importPreview.failed_rows_report.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-2xs text-red-700">
                    {importPreview.failed_rows_report.map((fail, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-bold">Row {fail.row}:</span>
                        <span>{fail.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ----------------- TAB 5, 6, 7, 8: STOCK ALERTS TABLES ----------------- */}
      {['low-stock', 'expiring', 'expired', 'out-of-stock'].includes(activeTab) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : alertStockList.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={CheckCircle2}
                title="All Good!"
                description={`No items currently trigger the "${activeTab.replace('-', ' ')}" alert.`}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-4">Medicine Name</th>
                    {activeTab === 'low-stock' || activeTab === 'out-of-stock' ? (
                      <>
                        <th className="p-4">Strength / Form</th>
                        <th className="p-4">Generic Name</th>
                        <th className="p-4">Available Quantity</th>
                        <th className="p-4">Reorder Level</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Quick Action</th>
                      </>
                    ) : (
                      <>
                        <th className="p-4">Batch Number</th>
                        <th className="p-4">Expiry Date</th>
                        <th className="p-4">Current Quantity</th>
                        <th className="p-4">Timeline / Countdown</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Quick Action</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertStockList.map((item, idx) => {
                    const isAggregated = activeTab === 'low-stock' || activeTab === 'out-of-stock';
                    const medId = item.medicine_id || item.id;
                    const availableQty = item.available_quantity !== undefined ? item.available_quantity : (item.quantity !== undefined ? item.quantity : 0);

                    // Countdown calculation for expiring/expired
                    let daysDiff = 0;
                    if (item.expiry_date) {
                      daysDiff = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                    }

                    return (
                      <tr key={item.id || item.medicine_id || idx} className="hover:bg-slate-50/70 transition">
                        <td className="p-4">
                          <div className="font-bold text-slate-800 text-sm">{item.medicine_name}</div>
                          {item.generic_name && (
                            <div className="text-slate-400 text-2xs">{item.generic_name}</div>
                          )}
                        </td>

                        {isAggregated ? (
                          <>
                            <td className="p-4 font-semibold text-blue-700">
                              {item.potency || item.strength || 'Standard'}
                            </td>
                            <td className="p-4 text-slate-500">{item.generic_name || '—'}</td>
                            <td className="p-4 font-bold text-red-600 text-sm">
                              {availableQty} <span className="text-2xs text-slate-400 font-normal">units</span>
                            </td>
                            <td className="p-4 font-bold text-slate-700">{item.reorder_level || 10}</td>
                            <td className="p-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                                  activeTab === 'out-of-stock'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {activeTab === 'out-of-stock' ? 'Out of Stock' : 'Low Stock'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => navigate(`/pharmacy/inventory/add-stock?medicine_id=${medId}`)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Stock</span>
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-4 font-mono font-bold text-slate-700">{item.batch_number || 'N/A'}</td>
                            <td className="p-4 font-semibold text-slate-800">
                              {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="p-4 font-bold text-slate-800 text-sm">
                              {item.quantity}{' '}
                              <span className="text-2xs text-slate-400 font-normal">units</span>
                            </td>
                            <td className="p-4">
                              {activeTab === 'expiring' ? (
                                <span className="font-semibold text-amber-700 inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-500" />
                                  {daysDiff <= 0 ? 'Expires today' : `${daysDiff} days left`}
                                </span>
                              ) : (
                                <span className="font-semibold text-red-700 inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-red-500" />
                                  {Math.abs(daysDiff)} days overdue
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                                  activeTab === 'expired'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {activeTab === 'expired' ? 'Expired' : 'Expiring Soon'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => navigate(`/pharmacy/inventory/add-stock?medicine_id=${medId}`)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-bold rounded-xl transition"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Replenish</span>
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Medicine Modal */}
      <Modal
        isOpen={isMedModalOpen}
        onClose={() => setIsMedModalOpen(false)}
        title={editingMed ? `Edit Formulary Item: ${editingMed?.medicine_name}` : 'Add Medicine to Pharmacy Formulary'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveMedicine} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Medicine Name *
            </label>
            <input
              type="text"
              required
              value={medFormData.medicine_name}
              onChange={(e) => setMedFormData({ ...medFormData, medicine_name: e.target.value })}
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
              value={medFormData.strength}
              onChange={(e) => setMedFormData({ ...medFormData, strength: e.target.value })}
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
              value={medFormData.quantity ?? ''}
              onChange={(e) => setMedFormData({ ...medFormData, quantity: e.target.value })}
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
              value={editingMed ? (medFormData.serial_number || '') : (nextSerial || 'AUTOMATICALLY GENERATED')}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed select-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              AUTOMATICALLY GENERATED — READ ONLY
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsMedModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingMed}
              className={`px-5 py-2.5 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer ${
                editingMed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {savingMed
                ? (editingMed ? 'Saving Changes...' : 'Saving to Formulary...')
                : (editingMed ? 'Save Changes' : 'Save to Formulary')}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Medicine Stock Batches Modal */}
      <Modal
        isOpen={isStockDetailModalOpen}
        onClose={() => setIsStockDetailModalOpen(false)}
        title={
          selectedMedStock?.medicine
            ? `Stock Batches: ${selectedMedStock.medicine.medicine_name} (${selectedMedStock.medicine.strength || 'Standard'})`
            : 'Medicine Stock Batches'
        }
      >
        <div className="space-y-4">
          {selectedMedStock?.medicine && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-2xs text-slate-400 uppercase font-bold block">Medicine Name</span>
                <span className="font-bold text-slate-800 truncate block">{selectedMedStock.medicine.medicine_name}</span>
              </div>
              <div>
                <span className="text-2xs text-slate-400 uppercase font-bold block">Serial Number</span>
                <span className="font-mono font-bold text-blue-700">
                  {selectedMedStock.medicine.serial_number || `MED-${String(selectedMedStock.medicine.id || 0).padStart(5, '0')}`}
                </span>
              </div>
              <div>
                <span className="text-2xs text-slate-400 uppercase font-bold block">Potency / Strength</span>
                <span className="font-semibold text-slate-700">{selectedMedStock.medicine.strength || '—'}</span>
              </div>
              <div>
                <span className="text-2xs text-slate-400 uppercase font-bold block">Total Stock</span>
                <span className="font-bold text-emerald-700">{selectedMedStock.batches?.reduce((acc, b) => acc + (parseInt(b.quantity, 10) || 0), 0) ?? 0} units</span>
              </div>
            </div>
          )}

          {loadingStockDetail ? (
            <div className="p-8 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : !selectedMedStock?.batches || selectedMedStock.batches.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200">
              <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No active stock batches recorded</p>
              <p className="text-2xs text-slate-500 mt-0.5">
                No inventory batches currently exist for this medicine in this branch.
              </p>
              <button
                onClick={() => {
                  setIsStockDetailModalOpen(false);
                  navigate(`/pharmacy/inventory/add-stock?medicine_id=${selectedMedStock?.medicine?.id}`);
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stock Batch</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-2xs">
                    <th className="p-2.5">Batch No</th>
                    <th className="p-2.5">Expiry Date</th>
                    <th className="p-2.5">Available Qty</th>
                    <th className="p-2.5">MRP (₹)</th>
                    <th className="p-2.5">Purchase (₹)</th>
                    <th className="p-2.5">Supplier</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedMedStock.batches.map((b) => {
                    const isExp = new Date(b.expiry_date) < new Date();
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-2.5 font-mono font-bold text-slate-800">{b.batch_number}</td>
                        <td className="p-2.5">
                          <span className={isExp ? 'text-red-600 font-bold' : 'text-slate-700'}>
                            {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">{b.quantity}</td>
                        <td className="p-2.5 text-slate-700">₹{b.mrp || '0.00'}</td>
                        <td className="p-2.5 text-slate-700">₹{b.purchase_rate || '0.00'}</td>
                        <td className="p-2.5 text-slate-500">{b.supplier || '—'}</td>
                        <td className="p-2.5">
                          {isExp ? (
                            <span className="px-1.5 py-0.5 rounded-full text-2xs font-bold bg-red-100 text-red-800">
                              Expired
                            </span>
                          ) : b.quantity === 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-700">
                              Depleted
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                setIsStockDetailModalOpen(false);
                navigate(`/pharmacy/inventory/add-stock?medicine_id=${selectedMedStock?.medicine?.id}`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-xl transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stock Batch</span>
            </button>
            <button
              type="button"
              onClick={() => setIsStockDetailModalOpen(false)}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
