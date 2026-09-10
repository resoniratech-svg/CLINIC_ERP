import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, X, CheckCircle2 } from 'lucide-react';
import { settingsApi } from '../../api';

/**
 * AilmentSelect
 *
 * A reusable, viewport-aware dropdown component for selecting or typing an Ailment / Requirement.
 *
 * Features:
 * - Perfectly anchored to the input container (matches width exactly)
 * - Viewport collision detection: opens downwards if space allows, automatically flips upwards if near the bottom
 * - Internal scrolling with a clean max-height
 * - Real-time filtering against the master ailments list
 * - Allows typing custom reasons/ailments
 * - Clear button (X) and Chevron toggle
 * - Click-outside and Escape key dismissal
 * - Consistent with WeCare Homeopathy ERP design system
 */
export const AilmentSelect = ({
  value = '',
  onChange,
  label = 'Ailment / Reason for Visit',
  labelClassName = 'block text-[11px] font-semibold text-slate-700 mb-1',
  required = false,
  placeholder = 'e.g. Fever, Bronchial Asthma, Allergy',
  ailments = null,
  containerClassName = '',
  inputClassName = '',
  name = 'ailment_reason',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState('down'); // 'down' | 'up'
  const [maxHeight, setMaxHeight] = useState(260);
  const [internalAilments, setInternalAilments] = useState([]);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // If ailments list is not supplied by parent, fetch active ailments from master data
  useEffect(() => {
    if (Array.isArray(ailments) && ailments.length > 0) return;
    let isMounted = true;
    settingsApi
      .getMasterData('ailments', { status: 'active' })
      .then((res) => {
        if (isMounted && res?.success && Array.isArray(res.data)) {
          setInternalAilments(res.data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [ailments]);

  const masterList = Array.isArray(ailments) && ailments.length > 0 ? ailments : internalAilments;

  // Viewport collision detection
  const updateDropdownPosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    const dropdownPreferredHeight = 260;
    const margin = 16;

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

  // Recalculate position on scroll / resize while open
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    const handleScrollOrResize = () => {
      updateDropdownPosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const handleValueChange = (newVal) => {
    if (typeof onChange === 'function') {
      const syntheticEvent = {
        target: {
          value: newVal,
          name,
        },
      };
      // Supports both onChange(e) and onChange(val)
      onChange(syntheticEvent, newVal);
    }
  };

  const filteredAilments = useMemo(() => {
    if (!value || !value.trim()) {
      return masterList;
    }
    const q = value.toLowerCase().trim();
    return masterList.filter((a) => (a.name || '').toLowerCase().includes(q));
  }, [masterList, value]);

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
          onFocus={() => {
            updateDropdownPosition();
            setIsOpen(true);
          }}
          onChange={(e) => {
            handleValueChange(e.target.value);
            updateDropdownPosition();
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          className={`w-full pl-3 pr-14 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-medium ${inputClassName}`}
        />

        {/* Action icons: Clear (X) and Chevron toggle */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleValueChange('');
                if (inputRef.current) inputRef.current.focus();
              }}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!isOpen) {
                updateDropdownPosition();
                setIsOpen(true);
                if (inputRef.current) inputRef.current.focus();
              } else {
                setIsOpen(false);
              }
            }}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer transition-colors"
            tabIndex={-1}
            title="Toggle ailments list"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Viewport-aware Floating Dropdown */}
      {isOpen && (
        <div
          style={{ maxHeight: `${maxHeight}px` }}
          className={`absolute left-0 right-0 w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-y-auto z-50 divide-y divide-slate-100 ${
            direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {masterList.length === 0 ? (
            <div className="p-3 text-center text-slate-400 text-xs">
              No registered ailments found in master data.
            </div>
          ) : filteredAilments.length === 0 ? (
            <div className="p-3 text-center text-slate-500 text-xs space-y-1">
              <div>No registered ailments matching "{value}".</div>
              <div className="text-[10px] text-slate-400">
                Click outside or keep typing to use this custom entry.
              </div>
            </div>
          ) : (
            filteredAilments.map((a) => {
              const isSelected =
                (value || '').trim().toLowerCase() === (a.name || '').trim().toLowerCase();
              return (
                <div
                  key={a.id || a.name}
                  onClick={() => {
                    handleValueChange(a.name);
                    setIsOpen(false);
                  }}
                  className={`px-3.5 py-2.5 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                    isSelected ? 'bg-blue-50 font-bold text-blue-900' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate pr-2 font-medium">{a.name}</span>
                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
