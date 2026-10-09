/**
 * Utility functions for 10-digit mobile number sanitation and validation
 */

/**
 * Strips all non-digit characters and caps at 10 digits
 * @param {string|number} value
 * @returns {string} 10-digit numeric string
 */
export const sanitizeMobile = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D/g, '').slice(0, 10);
};

/**
 * Checks if a value is strictly a 10-digit number
 * @param {string|number} value
 * @returns {boolean}
 */
export const isValidMobile = (value) => {
  if (!value) return false;
  return /^[0-9]{10}$/.test(String(value).trim());
};

/**
 * Validates a mobile value and returns an error message if invalid
 * @param {string|number} value
 * @param {boolean} required
 * @returns {string|null}
 */
export const validateMobile = (value, required = true) => {
  const digits = sanitizeMobile(value);
  if (!digits) {
    return required ? 'Mobile number is required' : null;
  }
  if (digits.length !== 10) {
    return 'Mobile number must be exactly 10 digits';
  }
  return null;
};
