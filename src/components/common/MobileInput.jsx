import React, { useState } from 'react';
import { sanitizeMobile } from '../../utils/mobileUtils';

/**
 * Reusable Mobile Number Input
 * Strictly enforces 10 digits, numeric only, strips non-digits on paste & change,
 * provides inline validation feedback.
 */
export const MobileInput = ({
  value = '',
  onChange,
  onBlur,
  name = 'mobile_number',
  id,
  placeholder = '9876543210',
  required = false,
  disabled = false,
  className = '',
  showInlineError = true,
  error: customError,
  autoComplete = 'tel',
  ...rest
}) => {
  const [touched, setTouched] = useState(false);

  const handleChange = (e) => {
    const raw = e.target.value;
    const clean = sanitizeMobile(raw);
    if (onChange) {
      onChange({
        target: {
          name,
          value: clean,
        },
      });
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData ? e.clipboardData.getData('text') : '';
    const clean = sanitizeMobile(pastedText);
    if (onChange) {
      onChange({
        target: {
          name,
          value: clean,
        },
      });
    }
  };

  const handleKeyDown = (e) => {
    // Allow navigation, delete, backspace, tab, copy/paste/select
    if (
      ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
      (e.ctrlKey || e.metaKey) // Ctrl/Cmd+A, C, V, X
    ) {
      return;
    }
    // Block non-digits
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    // Block typing more than 10 digits if text isn't selected
    const selectionLength = e.target.selectionEnd - e.target.selectionStart;
    if (String(value || '').length >= 10 && selectionLength === 0) {
      e.preventDefault();
    }
  };

  const handleBlur = (e) => {
    setTouched(true);
    if (onBlur) onBlur(e);
  };

  const cleanVal = sanitizeMobile(value);
  const isInvalid = cleanVal.length > 0 && cleanVal.length < 10;
  const errorMsg = customError || (isInvalid ? 'Mobile number must be exactly 10 digits' : null);

  const defaultClasses =
    'w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-medium';

  return (
    <div className="w-full">
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]{10}"
        maxLength={10}
        name={name}
        id={id}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={cleanVal}
        onChange={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={`${className || defaultClasses} ${
          touched && errorMsg ? '!border-red-400 focus:!ring-red-400' : ''
        }`}
        {...rest}
      />
      {showInlineError && touched && errorMsg && (
        <p className="mt-1 text-[11px] font-semibold text-red-600 transition-all">
          {errorMsg}
        </p>
      )}
    </div>
  );
};
