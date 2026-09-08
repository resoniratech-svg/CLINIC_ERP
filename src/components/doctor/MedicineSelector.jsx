import React, { useState, useEffect, useRef, useCallback } from 'react';
import { pharmacyApi } from '../../api';
import { Search, ChevronDown, X, Pill, RefreshCw, AlertCircle, Check } from 'lucide-react';

export const MedicineSelector = ({
  selectedMedicine = null,
  onSelectMedicine,
  onClear,
  disabled = false,
  placeholder = 'Search medicine name, generic name...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const searchRequestIdRef = useRef(0);

  // Fetch medicines from backend API
  const fetchMedicines = useCallback(async (query = '') => {
    const requestId = ++searchRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = { status: 'active' };
      if (query.trim()) {
        params.search = query.trim();
      }
      const res = await pharmacyApi.getMedicines(params);
      
      // Ensure we only process the latest in-flight request
      if (requestId === searchRequestIdRef.current) {
        if (res.success) {
          setMedicines(res.data || []);
          setHighlightedIndex(0);
        } else {
          setError(res.message || 'Failed to load medicines');
        }
      }
    } catch (err) {
      if (requestId === searchRequestIdRef.current) {
        setError(err.message || 'Failed to fetch medicines');
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Handle open / focus
  const handleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      setIsOpen(true);
      fetchMedicines(searchTerm);
    }
  };

  // Handle input changes with debounced search
  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!isOpen) {
      setIsOpen(true);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchMedicines(val);
    }, 250);
  };

  // Select a medicine
  const handleSelect = (med) => {
    if (onSelectMedicine) {
      onSelectMedicine(med);
    }
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Clear selected medicine
  const handleClear = (e) => {
    e.stopPropagation();
    setSearchTerm('');
    if (onClear) {
      onClear();
    }
    if (isOpen) {
      fetchMedicines('');
    }
    inputRef.current?.focus();
  };

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < medicines.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < medicines.length) {
        handleSelect(medicines[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Searchable Combobox Trigger */}
      <div
        onClick={() => {
          if (!disabled) {
            handleOpen();
            inputRef.current?.focus();
          }
        }}
        className={`relative flex items-center w-full px-3 py-2 text-xs rounded-xl border bg-white transition-all cursor-text ${
          disabled
            ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-75'
            : isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-xs'
            : selectedMedicine
            ? 'border-emerald-300 bg-emerald-50/20'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="mr-2 text-slate-400 shrink-0">
          {loading ? (
            <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
          ) : selectedMedicine ? (
            <Pill className="w-4 h-4 text-emerald-600" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>

        {/* If a medicine is selected and dropdown is closed, show selected preview or editable input */}
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedMedicine ? selectedMedicine.medicine_name : searchTerm}
          onChange={handleInputChange}
          onFocus={handleOpen}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={selectedMedicine ? selectedMedicine.medicine_name : placeholder}
          className="w-full bg-transparent outline-none text-xs text-slate-800 placeholder-slate-400 font-medium"
        />

        {/* Selected badge info (if closed and medicine selected) */}
        {!isOpen && selectedMedicine && (
          <div className="hidden sm:flex items-center gap-1.5 mr-2 shrink-0">
            {selectedMedicine.strength && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800">
                {selectedMedicine.strength}
              </span>
            )}
            {selectedMedicine.medicine_type && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 text-slate-600 capitalize">
                {selectedMedicine.medicine_type}
              </span>
            )}
          </div>
        )}

        {/* Action icons: Clear & Dropdown Chevron */}
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {(selectedMedicine || searchTerm) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-100 transition cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (isOpen) {
                setIsOpen(false);
              } else {
                handleOpen();
                inputRef.current?.focus();
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            title="Toggle dropdown"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col max-h-64 sm:max-h-72">
          {/* Status states */}
          {loading && medicines.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
              <span>Loading medicines from catalog...</span>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-xs text-red-600 flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchMedicines(searchTerm)}
                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : medicines.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <Pill className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
              <p className="font-semibold text-slate-600">No medicines found</p>
              {searchTerm && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No matching results for &ldquo;{searchTerm}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-slate-100">
              {medicines.map((med, idx) => {
                const isSelected = selectedMedicine?.id === med.id;
                const isHighlighted = highlightedIndex === idx;

                return (
                  <div
                    key={med.id}
                    onClick={() => handleSelect(med)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2.5 text-xs transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-semibold'
                        : isHighlighted
                        ? 'bg-slate-50 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`mt-0.5 p-1 rounded-md shrink-0 ${isSelected ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                        <Pill className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{med.medicine_name}</span>
                          {med.category && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600">
                              {med.category}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                          {med.generic_name && (
                            <span className="text-slate-600 italic">
                              Generic: {med.generic_name}
                            </span>
                          )}
                          {med.strength && (
                            <span className="font-medium text-emerald-700">
                              {med.strength}
                            </span>
                          )}
                          {med.medicine_type && (
                            <span className="text-slate-400 capitalize">
                              • {med.medicine_type}
                            </span>
                          )}
                          {med.unit && (
                            <span className="text-slate-400">
                              ({med.unit})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="shrink-0 text-emerald-600 mr-1">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
