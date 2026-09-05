/**
 * Safely converts an ISO date string / Date object into 'YYYY-MM-DD' formatted string
 * based on the user's local timezone (e.g. IST).
 */
export const toLocalDateString = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns today's date formatted as 'YYYY-MM-DD' in local timezone.
 */
export const getTodayDateString = () => {
  return toLocalDateString(new Date());
};

/**
 * Returns readable formatted date e.g. "02 Sep 2026"
 */
export const formatDisplayDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};
