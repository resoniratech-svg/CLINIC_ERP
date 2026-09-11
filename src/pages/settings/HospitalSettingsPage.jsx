import React, { useEffect, useState } from 'react';
import { settingsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { Sliders, Building, Plus, CheckCircle2, MapPin, Layers, Search, Activity, Edit2, Power, Check, X, Building2 } from 'lucide-react';

export const HospitalSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('hospital');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Master data states
  const [masterType, setMasterType] = useState('villages');
  const [masterList, setMasterList] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [newMasterName, setNewMasterName] = useState('');
  const [newMasterMandalId, setNewMasterMandalId] = useState('');
  const [addingMaster, setAddingMaster] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Edit modal states
  const [editingItem, setEditingItem] = useState(null); // { id, name, mandal_id }
  const [savingEdit, setSavingEdit] = useState(false);

  // Auxiliary data for relations (e.g. mandals for villages)
  const [mandalsList, setMandalsList] = useState([]);

  const { showToast } = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await settingsApi.getHospitalSettings();
      if (res.success) setSettings(res.data);
    } catch (err) {
      showToast(err.message || 'Failed to fetch hospital settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMandals = async () => {
    try {
      const res = await settingsApi.getMasterData('mandals', { status: 'active' });
      if (res.success) setMandalsList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch mandals:', err);
    }
  };

  const fetchMasterData = async (type) => {
    setLoadingMaster(true);
    setMasterList([]);
    try {
      const res = await settingsApi.getMasterData(type);
      if (res.success) setMasterList(res.data || []);
    } catch (err) {
      showToast(err.message || `Failed to fetch ${type.replace('_', ' ')}`, 'error');
    } finally {
      setLoadingMaster(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'hospital') fetchSettings();
    else if (activeTab === 'masters') {
      fetchMasterData(masterType);
      if (masterType === 'villages') fetchMandals();
    }
  }, [activeTab, masterType]);

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await settingsApi.updateHospitalSettings(settings);
      if (res.success) {
        showToast('Hospital settings saved successfully', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to save hospital settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddMasterItem = async (e) => {
    e.preventDefault();
    if (!newMasterName.trim()) return;

    setAddingMaster(true);
    try {
      const payload = { name: newMasterName.trim() };
      if (masterType === 'villages' && newMasterMandalId) {
        payload.mandal_id = parseInt(newMasterMandalId, 10);
      }

      const res = await settingsApi.addMasterData(masterType, payload);
      if (res.success) {
        showToast(`Added to ${masterType.replace('_', ' ')}`, 'success');
        setNewMasterName('');
        setNewMasterMandalId('');
        fetchMasterData(masterType);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to add master data entry';
      showToast(msg, 'error');
    } finally {
      setAddingMaster(false);
    }
  };

  const handleEditMasterItem = async (e) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;

    setSavingEdit(true);
    try {
      const payload = { name: editingItem.name.trim() };
      if (masterType === 'villages') {
        payload.mandal_id = editingItem.mandal_id ? parseInt(editingItem.mandal_id, 10) : null;
      }

      const res = await settingsApi.updateMasterData(masterType, editingItem.id, payload);
      if (res.success) {
        showToast(`Updated ${editingItem.name}`, 'success');
        setEditingItem(null);
        fetchMasterData(masterType);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update entry';
      showToast(msg, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const res = await settingsApi.toggleMasterDataStatus(masterType, item.id);
      if (res.success) {
        showToast(res.message || `Status updated for ${item.name}`, 'success');
        fetchMasterData(masterType);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to toggle status';
      showToast(msg, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <span>Hospital Configuration & Master Data Registries</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage clinic profile details, OPD slot durations, invoice formatting, and demographic masters
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('hospital')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'hospital'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>General Hospital Parameters</span>
        </button>

        <button
          onClick={() => setActiveTab('masters')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'masters'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Master Data Registries</span>
        </button>
      </div>

      {/* TAB 1: HOSPITAL SETTINGS */}
      {activeTab === 'hospital' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
          {loading || !settings ? (
            <LoadingSpinner label="Loading clinic configuration..." />
          ) : (
            <form onSubmit={handleUpdateSettings} className="space-y-6 text-xs text-slate-700 max-w-3xl">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Organization Identification
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Hospital / Clinic Name</label>
                    <input
                      type="text"
                      value={settings.hospital_name || ''}
                      onChange={(e) => setSettings({ ...settings, hospital_name: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Official Contact Phone</label>
                    <input
                      type="text"
                      value={settings.hospital_phone || ''}
                      onChange={(e) => setSettings({ ...settings, hospital_phone: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={settings.hospital_email || ''}
                      onChange={(e) => setSettings({ ...settings, hospital_email: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Clinic Address</label>
                    <input
                      type="text"
                      value={settings.hospital_address || ''}
                      onChange={(e) => setSettings({ ...settings, hospital_address: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Clinical & Billing Operational Parameters
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Appointment Slot Duration (Min)</label>
                    <input
                      type="number"
                      value={settings.appointment_slot_duration || 15}
                      onChange={(e) => setSettings({ ...settings, appointment_slot_duration: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Registration Validity (Days)</label>
                    <input
                      type="number"
                      value={settings.registration_validity_days || 30}
                      onChange={(e) => setSettings({ ...settings, registration_validity_days: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Invoice Prefix</label>
                    <input
                      type="text"
                      value={settings.invoice_prefix || 'INV-'}
                      onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingSettings ? 'Saving Settings...' : 'Save Hospital Configuration'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: MASTER DATA REGISTRIES */}
      {activeTab === 'masters' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-1 bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-3 py-1">
              Select Registry Domain
            </span>
            {[
              { id: 'villages', label: 'Villages' },
              { id: 'mandals', label: 'Mandals' },
              { id: 'lead_sources', label: 'Lead Sources' },
              { id: 'referral_sources', label: 'Referral Sources' },
              { id: 'departments', label: 'Departments' },
              { id: 'specializations', label: 'Specializations' },
              { id: 'charge_types', label: 'Charge Types' },
              { id: 'expense_categories', label: 'Expense Categories' },
              { id: 'ailments', label: 'Ailments (Patient Problems)' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMasterType(m.id);
                  setSearchFilter('');
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                  masterType === m.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{m.label}</span>
                {m.id === 'ailments' && masterType !== m.id && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                    Homeopathy
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="md:col-span-3 space-y-4">
            {/* Add item */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <form onSubmit={handleAddMasterItem} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  placeholder={
                    masterType === 'ailments'
                      ? 'Add new ailment / patient problem (e.g. Fever, Bronchial Asthma, Migraine)...'
                      : `Add new entry to ${masterType.replace('_', ' ')}...`
                  }
                  value={newMasterName}
                  onChange={(e) => setNewMasterName(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />

                {masterType === 'villages' && (
                  <select
                    value={newMasterMandalId}
                    onChange={(e) => setNewMasterMandalId(e.target.value)}
                    className="sm:w-48 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select Mandal (Optional)</option>
                    {mandalsList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="submit"
                  disabled={addingMaster}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {addingMaster ? 'Adding...' : 'Add Entry'}
                </button>
              </form>
            </div>

            {/* List Header with Stats, Status Tabs & Search */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-3.5 px-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-xs">
                    {masterType === 'ailments'
                      ? 'Ailments & Clinical Patient Problems'
                      : `${masterType.replace('_', ' ').toUpperCase()} REGISTRY`}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono">
                    {masterList.length} items
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Status filter tabs */}
                  <div className="flex items-center bg-slate-200/60 p-0.5 rounded-xl text-[11px]">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        statusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({masterList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('active')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        statusFilter === 'active'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active ({masterList.filter((i) => (i.status || 'active') === 'active').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('inactive')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        statusFilter === 'inactive'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Inactive ({masterList.filter((i) => i.status === 'inactive').length})
                    </button>
                  </div>

                  {/* Search box */}
                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search entries..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {loadingMaster ? (
                <LoadingSpinner label="Loading registry items..." />
              ) : masterList
                  .filter((item) => {
                    const qLower = searchFilter.toLowerCase();
                    const matchesSearch =
                      !searchFilter ||
                      (item.name || '').toLowerCase().includes(qLower) ||
                      (item.mandal_name && item.mandal_name.toLowerCase().includes(qLower));
                    const matchesStatus =
                      statusFilter === 'all' ||
                      (statusFilter === 'active' && (item.status || 'active') === 'active') ||
                      (statusFilter === 'inactive' && item.status === 'inactive');
                    return matchesSearch && matchesStatus;
                  }).length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-medium">
                  {searchFilter
                    ? `No matches found for "${searchFilter}"`
                    : `No records match the current filter in ${masterType.replace('_', ' ')}.`}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs max-h-[500px] overflow-y-auto">
                  {masterList
                    .filter((item) => {
                      const qLower = searchFilter.toLowerCase();
                      const matchesSearch =
                        !searchFilter ||
                        (item.name || '').toLowerCase().includes(qLower) ||
                        (item.mandal_name && item.mandal_name.toLowerCase().includes(qLower));
                      const matchesStatus =
                        statusFilter === 'all' ||
                        (statusFilter === 'active' && (item.status || 'active') === 'active') ||
                        (statusFilter === 'inactive' && item.status === 'inactive');
                      return matchesSearch && matchesStatus;
                    })
                    .map((item) => {
                      const isActive = (item.status || 'active') === 'active';
                      return (
                        <div
                          key={item.id}
                          className="p-3 px-5 flex items-center justify-between hover:bg-slate-50 transition-colors gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isActive ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            ></span>
                            <span
                              className={`font-bold truncate ${
                                isActive ? 'text-slate-800' : 'text-slate-400 line-through'
                              }`}
                            >
                              {item.name}
                            </span>

                            {/* Mandal attribution badge if village */}
                            {masterType === 'villages' && (
                              item.mandal_name ? (
                                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 shrink-0">
                                  Mandal: {item.mandal_name}
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                                  Mandal: Unassigned
                                </span>
                              )
                            )}

                            {/* Status badge */}
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                              ID: #{item.id}
                            </span>

                            {/* Edit / Rename Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setEditingItem({
                                  id: item.id,
                                  name: item.name,
                                  mandal_id: item.mandal_id || ''
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer flex items-center gap-1"
                              title="Rename / Edit Entry"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            {/* Status Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                isActive
                                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                              title={isActive ? 'Deactivate this entry' : 'Activate this entry'}
                            >
                              <Power className="w-3 h-3" />
                              <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / RENAME MASTER ENTRY */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={`Edit ${masterType.replace('_', ' ')} Entry`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleEditMasterItem} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Entry Name *</label>
            <input
              type="text"
              required
              value={editingItem?.name || ''}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-900"
            />
          </div>

          {masterType === 'villages' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Associated Mandal (Optional)</label>
              <select
                value={editingItem?.mandal_id || ''}
                onChange={(e) => setEditingItem({ ...editingItem, mandal_id: e.target.value })}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">No associated mandal</option>
                {mandalsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
