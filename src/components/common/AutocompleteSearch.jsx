import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, User, Stethoscope, Pill, AlertCircle, ChevronDown } from 'lucide-react';

/**
 * Helper to highlight matched query substring within text
 */
export const HighlightMatch = ({ text = '', query = '' }) => {
  if (!text) return null;
  const str = String(text);
  const q = String(query || '').trim();
  if (!q) return <span>{str}</span>;

  // Escape special regex characters in query
  const escapedQuery = q.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = str.split(regex);

  return (
    <span>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-amber-100 text-amber-950 font-bold px-0.5 rounded not-italic">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
};

export const AutocompleteSearch = ({
  searchFn,
  onSelect,
  selectedItem = null,
  onClear = null,
  placeholder = 'Search...',
  label = null,
  required = false,
  error = null,
  renderItem = null,
  getItemLabel = (item) => item?.full_name || item?.patient_name || item?.medicine_name || item?.lead_name || item?.name || '',
  getItemSub = (item) => {
    const parts = [];
    if (item?.registration_id) parts.push(item.registration_id);
    if (item?.doctor_code) parts.push(item.doctor_code);
    if (item?.employee_id) parts.push(item.employee_id);
    if (item?.serial_number) parts.push(item.serial_number);
    if (item?.mobile_number) parts.push(item.mobile_number);
    if (item?.age && item?.gender) parts.push(`${item.age}y/${item.gender}`);
    else if (item?.gender) parts.push(item.gender);
    if (item?.village || item?.mandal) parts.push(item.village || item.mandal);
    if (item?.specialization) parts.push(item.specialization);
    if (item?.strength || item?.potency) parts.push([item.strength, item.potency].filter(Boolean).join(' '));
    return parts.join(' • ');
  },
  showFindButton = true,
  findButtonText = 'Find',
  findButtonColor = 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white',
  minChars = 1,
  debounceMs = 300,
  className = '',
  inputClassName = '',
  autoFocus = false,
  initialQuery = '',
  disabled = false,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchError, setSearchError] = useState(null);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const timerRef = useRef(null);
  const requestIdRef = useRef(0);

  // Sync selectedItem display text into query if selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      const displayStr = getItemLabel(selectedItem);
      setQuery(displayStr);
      setIsOpen(false);
    }
  }, [selectedItem]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup pending timer and abort controller on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Core search execution
  const executeSearch = useCallback(
    async (searchTerm) => {
      const term = String(searchTerm || '').trim();
      if (!term || term.length < minChars) {
        setResults([]);
        setLoading(false);
        setIsOpen(false);
        setSearchError(null);
        return;
      }

      // Cancel prior in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const currentReqId = ++requestIdRef.current;
      setLoading(true);
      setSearchError(null);
      setIsOpen(true);
      setSelectedIndex(-1);

      try {
        const data = await searchFn(term, controller.signal);
        // Discard stale responses if newer request has been triggered
        if (currentReqId !== requestIdRef.current) return;

        let list = [];
        const payload = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;

        if (Array.isArray(data)) {
          list = data;
        } else if (Array.isArray(payload)) {
          list = payload;
        } else if (payload && Array.isArray(payload.patients)) {
          list = payload.patients;
        } else if (payload && Array.isArray(payload.doctors)) {
          list = payload.doctors;
        } else if (payload && Array.isArray(payload.medicines)) {
          list = payload.medicines;
        } else if (payload && Array.isArray(payload.data)) {
          list = payload.data;
        } else if (payload && Array.isArray(payload.results)) {
          list = payload.results;
        } else if (payload && Array.isArray(payload.items)) {
          list = payload.items;
        } else if (payload && payload.patient) {
          list = [payload.patient];
        }

        setResults(list || []);
        setIsOpen(true);
      } catch (err) {
        if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          return; // Ignore intentional aborts
        }
        if (currentReqId === requestIdRef.current) {
          setSearchError(err.message || 'Search failed');
          setResults([]);
        }
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [searchFn, minChars]
  );

  // Handle live input change with debouncing
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    // If an item was previously selected and user types, clear previous selection
    if (selectedItem && onClear) {
      onClear();
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!val.trim() || val.trim().length < minChars) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    // Debounce execution ~300ms
    timerRef.current = setTimeout(() => {
      executeSearch(val);
    }, debounceMs);
  };

  // Immediate search on Find button or Enter
  const handleImmediateSearch = (e) => {
    if (e) e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    executeSearch(query);
  };

  // Clear input and selection
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    setSearchError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  // Select an item from results
  const handleSelect = (item) => {
    const displayStr = getItemLabel(item);
    setQuery(displayStr);
    setIsOpen(false);
    setResults([]);
    setSelectedIndex(-1);
    if (onSelect) onSelect(item);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && results.length > 0) {
        setIsOpen(true);
        setSelectedIndex(0);
      } else if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else {
        // Run immediate search
        e.preventDefault();
        handleImmediateSearch();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="flex gap-2 relative">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            autoFocus={autoFocus}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0 && query.trim()) setIsOpen(true);
            }}
            placeholder={placeholder}
            className={`w-full pl-8 pr-8 py-2 text-xs rounded-xl border ${
              error
                ? 'border-red-400 bg-red-50/20 focus:ring-red-500'
                : selectedItem
                ? 'border-emerald-400 bg-emerald-50/20 font-semibold text-slate-900 focus:ring-emerald-500'
                : 'border-slate-300 bg-white focus:ring-blue-500'
            } focus:ring-2 focus:outline-none transition-all ${inputClassName}`}
          />

          {loading ? (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {showFindButton && (
          <button
            type="button"
            disabled={disabled || loading || !query.trim()}
            onClick={handleImmediateSearch}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl cursor-pointer transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1.5 ${findButtonColor}`}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>{loading ? 'Finding...' : findButtonText}</span>
          </button>
        )}
      </div>

      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}

      {/* Floating Dropdown Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          {loading && results.length === 0 ? (
            <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Searching matches...</span>
            </div>
          ) : searchError ? (
            <div className="p-3 text-center text-xs text-red-600 flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No matching records found for <span className="font-semibold text-slate-600">"{query}"</span>
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Matching Results ({results.length})</span>
                <span className="font-normal text-[9px] text-slate-400">Use ↑ ↓ to navigate, Enter to select</span>
              </div>
              {results.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                const primary = getItemLabel(item);
                const secondary = getItemSub(item);

                return (
                  <div
                    key={item.patient_id || item.doctor_id || item.user_id || item.id || idx}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelect(item)}
                    className={`p-2.5 cursor-pointer text-xs transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {renderItem ? (
                      renderItem(item, { query, isSelected })
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">
                            <HighlightMatch text={primary} query={query} />
                          </span>
                          {item.registration_id && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                              <HighlightMatch text={item.registration_id} query={query} />
                            </span>
                          )}
                          {item.doctor_code && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded">
                              <HighlightMatch text={item.doctor_code} query={query} />
                            </span>
                          )}
                        </div>
                        {secondary && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            <HighlightMatch text={secondary} query={query} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};
