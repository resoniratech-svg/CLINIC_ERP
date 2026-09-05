import React, { useEffect, useState } from 'react';
import { settingsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { Sliders, Building, Plus, CheckCircle2, MapPin, Layers } from 'lucide-react';

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
  const [addingMaster, setAddingMaster] = useState(false);

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
    else if (activeTab === 'masters') fetchMasterData(masterType);
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
      const res = await settingsApi.addMasterData(masterType, { name: newMasterName.trim() });
      if (res.success) {
        showToast(`Added to ${masterType}`, 'success');
        setNewMasterName('');
        fetchMasterData(masterType);
      }
    } catch (err) {
      showToast(err.message || 'Failed to add master data entry', 'error');
    } finally {
      setAddingMaster(false);
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
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMasterType(m.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  masterType === m.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="md:col-span-3 space-y-4">
            {/* Add item */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <form onSubmit={handleAddMasterItem} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder={`Add new entry to ${masterType.replace('_', ' ')}...`}
                  value={newMasterName}
                  onChange={(e) => setNewMasterName(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={addingMaster}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {addingMaster ? 'Adding...' : 'Add Entry'}
                </button>
              </form>
            </div>

            {/* List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
              {loadingMaster ? (
                <LoadingSpinner label="Loading registry items..." />
              ) : masterList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-medium">
                  No records in {masterType.replace('_', ' ')} yet. Add entries using the field above.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {masterList.map((item) => (
                    <div key={item.id} className="p-3.5 px-5 flex items-center justify-between hover:bg-slate-50">
                      <span className="font-bold text-slate-800">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: #{item.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
