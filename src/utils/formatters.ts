/**
 * Utility functions for numeric display across the dashboard.
 * Enforces standard Mexican / Spanish format with commas as thousands separators (e.g., 1,234.50 or 1,234).
 */

export function formatThousands(
  value: number | string | null | undefined,
  decimals?: number
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(num)) return '0';

  if (decimals !== undefined) {
    return num.toLocaleString('es-MX', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  // Preserve up to 2 decimal places if present, otherwise format integer
  return num.toLocaleString('es-MX', {
    maximumFractionDigits: 2,
  });
}

/**
 * Format hours specifically:
 * If it has a decimal part (e.g. 13.5, 73.25), show it clearly with decimal places.
 * If integer (e.g. 60, 200), show integer with thousand separator.
 */
export function formatHours(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(num)) return '0';

  const hasDecimal = num % 1 !== 0;
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: hasDecimal ? 1 : 0,
    maximumFractionDigits: 2,
  });
}
