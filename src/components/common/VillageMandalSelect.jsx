import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X, MapPin, Building2, PlusCircle, Check } from 'lucide-react';
import { settingsApi } from '../../api';

/**
 * VillageMandalSelect
 *
 * Production-ready, viewport-aware autocomplete and dropdown for Village and Mandal selection.
 *
 * Features:
 * - Perfectly aligned with input container width (w-full, no detachment)
 * - Viewport collision detection (opens downward by default, flips upward if close to bottom)
 * - Internal scrolling with max-height ~280px and z-50 overlay
 * - Shows clear hierarchical tags: "Village" badge with parent Mandal name, and "Mandal" badge
 * - Selecting a Village formats input as: "Village Name, Mandal Name"
 * - Selecting a Mandal formats input as: "Mandal Name"
 * - Intelligent new location detection: if user types "kachapur, bhiknur", shows "+ New Location" card
 * - Clean clear (X) button, click-outside and Escape key dismissal
 */
export const VillageMandalSelect = ({
  value = '',
  villageId = null,
  mandalId = null,
  onSelect,
  onChange,
  label = 'Village / Mandal',
  labelClassName = 'block text-[11px] font-semibold text-slate-700 mb-1',
  required = false,
  placeholder = 'e.g. Pothugal, Karimnagar or type new Village, Mandal',
  villages = null,
  mandals = null,
  containerClassName = '',
  inputClassName = '',
  name = 'village_mandal',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState('down'); // 'down' | 'up'
  const [maxHeight, setMaxHeight] = useState(280);
  const [internalVillages, setInternalVillages] = useState([]);
  const [internalMandals, setInternalMandals] = useState([]);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch active master data if not provided via props
  useEffect(() => {
    let isMounted = true;
    if (!Array.isArray(villages) || villages.length === 0) {
      settingsApi.getMasterData('villages', { status: 'active' })
        .then((res) => {
          if (isMounted && res?.success && Array.isArray(res.data)) {
            setInternalVillages(res.data);
          }
        })
        .catch(() => {});
    }
    if (!Array.isArray(mandals) || mandals.length === 0) {
      settingsApi.getMasterData('mandals', { status: 'active' })
        .then((res) => {
          if (isMounted && res?.success && Array.isArray(res.data)) {
            setInternalMandals(res.data);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [villages, mandals]);

  const activeVillages = Array.isArray(villages) && villages.length > 0 ? villages : internalVillages;
  const activeMandals = Array.isArray(mandals) && mandals.length > 0 ? mandals : internalMandals;

  // Viewport collision detection
  const updateDropdownPosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    const dropdownPreferredHeight = 280;
    const margin = 12;

    if (spaceBelow < dropdownPreferredHeight && spaceAbove > spaceBelow) {
      setDirection('up');
      setMaxHeight(Math.max(120, Math.min(dropdownPreferredHeight, spaceAbove - margin)));
    } else {
      setDirection('down');
      setMaxHeight(Math.max(120, Math.min(dropdownPreferredHeight, spaceBelow - margin)));
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update position on scroll / resize while open
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    const handleScrollOrResize = () => updateDropdownPosition();
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  // Parse new location if user enters comma or two-part string
  const parsedNewLocation = useMemo(() => {
    if (!value || typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;

    let vPart = null;
    let mPart = null;

    if (raw.includes(',')) {
      const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        vPart = parts[0];
        mPart = parts.slice(1).join(', ').trim();
      }
    } else if (/\s+[-—]\s+/.test(raw)) {
      const parts = raw.split(/\s+[-—]\s+/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        vPart = parts[0];
        mPart = parts.slice(1).join(' ').trim();
      }
    } else {
      const words = raw.split(/\s+/);
      if (words.length >= 2) {
        vPart = words[0];
        mPart = words.slice(1).join(' ');
      }
    }

    if (vPart && mPart) {
      // Check if this exact combination already exists in master data
      const vLower = vPart.toLowerCase();
      const mLower = mPart.toLowerCase();
      const exists = activeVillages.some(
        v => (v.name || '').toLowerCase() === vLower && (v.mandal_name || '').toLowerCase() === mLower
      );
      if (!exists) {
        return { village: vPart, mandal: mPart, displayName: `${vPart}, ${mPart}` };
      }
    }
    return null;
  }, [value, activeVillages]);

  // Filter existing villages and mandals based on input
  const { filteredVillages, filteredMandals } = useMemo(() => {
    const q = (value || '').toLowerCase().trim();
    if (!q) {
      return {
        filteredVillages: activeVillages.slice(0, 30),
        filteredMandals: activeMandals.slice(0, 15)
      };
    }

    // Split search query if contains comma (e.g. "pothugal, karimnagar")
    let vSearch = q;
    let mSearch = '';
    if (q.includes(',')) {
      const parts = q.split(',').map(s => s.trim());
      vSearch = parts[0] || '';
      mSearch = parts[1] || '';
    }

    const matchedVillages = activeVillages.filter(v => {
      const vName = (v.name || '').toLowerCase();
      const mName = (v.mandal_name || '').toLowerCase();
      if (mSearch) {
        return vName.includes(vSearch) && mName.includes(mSearch);
      }
      return vName.includes(vSearch) || mName.includes(vSearch);
    });

    const matchedMandals = activeMandals.filter(m => {
      const mName = (m.name || '').toLowerCase();
      return mName.includes(vSearch);
    });

    return {
      filteredVillages: matchedVillages.slice(0, 40),
      filteredMandals: matchedMandals.slice(0, 15)
    };
  }, [activeVillages, activeMandals, value]);

  const handleSelectVillage = (village) => {
    const vName = village.name;
    const mName = village.mandal_name || '';
    const display = mName ? `${vName}, ${mName}` : vName;

    if (typeof onSelect === 'function') {
      onSelect({
        type: 'village',
        villageId: village.id,
        villageName: vName,
        mandalId: village.mandal_id,
        mandalName: mName,
        displayName: display,
        isNew: false
      });
    }
    if (typeof onChange === 'function') {
      onChange({ target: { name, value: display } }, display);
    }
    setIsOpen(false);
  };

  const handleSelectMandal = (mandal) => {
    const mName = mandal.name;

    if (typeof onSelect === 'function') {
      onSelect({
        type: 'mandal',
        villageId: null,
        villageName: null,
        mandalId: mandal.id,
        mandalName: mName,
        displayName: mName,
        isNew: false
      });
    }
    if (typeof onChange === 'function') {
      onChange({ target: { name, value: mName } }, mName);
    }
    setIsOpen(false);
  };

  const handleSelectNewLocation = () => {
    if (!parsedNewLocation) return;
    const display = parsedNewLocation.displayName;

    if (typeof onSelect === 'function') {
      onSelect({
        type: 'new_location',
        villageId: null,
        villageName: parsedNewLocation.village,
        mandalId: null,
        mandalName: parsedNewLocation.mandal,
        displayName: display,
        isNew: true
      });
    }
    if (typeof onChange === 'function') {
      onChange({ target: { name, value: display } }, display);
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (typeof onSelect === 'function') {
      onSelect({
        type: null,
        villageId: null,
        villageName: null,
        mandalId: null,
        mandalName: null,
        displayName: '',
        isNew: false
      });
    }
    if (typeof onChange === 'function') {
      onChange({ target: { name, value: '' } }, '');
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const hasMatches = filteredVillages.length > 0 || filteredMandals.length > 0 || parsedNewLocation;

  return (
    <div className={`relative ${containerClassName}`} ref={containerRef}>
      {label && (
        <label className={labelClassName}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={value || ''}
          required={required}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => {
            updateDropdownPosition();
            setIsOpen(true);
          }}
          onChange={(e) => {
            const val = e.target.value;
            if (typeof onChange === 'function') {
              onChange(e, val);
            }
            updateDropdownPosition();
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          className={`w-full pl-3 pr-16 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
            disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
          } ${inputClassName}`}
        />

        {/* Right action icons */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
              title="Clear location"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                updateDropdownPosition();
                setIsOpen(!isOpen);
                if (!isOpen && inputRef.current) {
                  inputRef.current.focus();
                }
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
            title="Toggle dropdown"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown */}
      {isOpen && (
        <div
          style={{ maxHeight: `${maxHeight}px` }}
          className={`absolute left-0 right-0 w-full bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden flex flex-col transition-all ${
            direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          <div className="overflow-y-auto divide-y divide-slate-100 py-1.5">
            {/* New Location detected card */}
            {parsedNewLocation && (
              <div
                onClick={handleSelectNewLocation}
                className="p-3 mx-2 my-1 bg-blue-50/80 border border-blue-200 rounded-xl hover:bg-blue-100/90 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <PlusCircle className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>New Location Detected</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold">
                    + Auto-Create
                  </span>
                </div>
                <div className="text-xs text-slate-800 mt-1 font-medium">
                  Village: <span className="font-bold text-blue-700">{parsedNewLocation.village}</span> • Mandal: <span className="font-bold text-blue-700">{parsedNewLocation.mandal}</span>
                </div>
                <span className="text-[10px] text-blue-600 block mt-0.5">
                  Will automatically create master data records and link to this patient
                </span>
              </div>
            )}

            {/* Existing Villages Section */}
            {filteredVillages.length > 0 && (
              <div>
                <div className="px-3 py-1 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-blue-500" />
                  <span>Villages ({filteredVillages.length})</span>
                </div>
                {filteredVillages.map((v) => {
                  const isSelected = villageId && String(villageId) === String(v.id);
                  return (
                    <div
                      key={`village-${v.id}`}
                      onClick={() => handleSelectVillage(v)}
                      className={`px-3 py-2 text-xs hover:bg-blue-50/60 cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected ? 'bg-blue-50 text-blue-900 font-bold' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 truncate">{v.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-100/70 text-blue-700 font-bold shrink-0">
                            Village
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <span>Mandal:</span>
                          <span className="font-medium text-slate-600">{v.mandal_name || 'General / Unassigned'}</span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Existing Mandals Section */}
            {filteredMandals.length > 0 && (
              <div>
                <div className="px-3 py-1 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-emerald-500" />
                  <span>Mandals ({filteredMandals.length})</span>
                </div>
                {filteredMandals.map((m) => {
                  const isSelected = !villageId && mandalId && String(mandalId) === String(m.id);
                  return (
                    <div
                      key={`mandal-${m.id}`}
                      onClick={() => handleSelectMandal(m)}
                      className={`px-3 py-2 text-xs hover:bg-emerald-50/60 cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected ? 'bg-emerald-50 text-emerald-900 font-bold' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 truncate">{m.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100/70 text-emerald-800 font-bold shrink-0">
                            Mandal
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Select to assign entire mandal
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!hasMatches && (
              <div className="p-4 text-center text-xs text-slate-400">
                <p>No matching village or mandal found.</p>
                <p className="text-[11px] text-blue-600 font-semibold mt-1">
                  Tip: Type &quot;Village, Mandal&quot; (e.g. &quot;Kachapur, Bhiknur&quot;) to auto-create both!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VillageMandalSelect;
