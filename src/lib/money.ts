const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** True minus sign, per the design (not an ASCII hyphen). */
export const MINUS = '−'

export function formatCents(cents: number): string {
  const abs = fmt.format(Math.abs(cents) / 100)
  return cents < 0 ? `${MINUS}${abs}` : abs
}

/** Format with an explicit sign: −$54.32 / +$1,650.00. Zero gets no sign. */
export function formatSigned(cents: number): string {
  if (cents > 0) return `+${fmt.format(cents / 100)}`
  return formatCents(cents)
}

/**
 * Parse a user-typed amount ("54.32", "$1,650", "1650.5") into positive cents.
 * Returns null when the input is not a usable amount.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

/** Convert a float dollar amount (e.g. from the Realm export) to cents. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * ATM-style entry: typed digits accumulate as cents from the right.
 * "18" → 18 (¢0.18), "183" → 183 ($1.83). Non-digits are stripped.
 * Returns null when no digits remain.
 */
export function digitsToCents(raw: string): number | null {
  const digits = raw.replace(/\D/g, '').slice(0, 12)
  if (!digits) return null
  return Number.parseInt(digits, 10)
}

/** Display string for ATM-style entry: 183 → "1.83", 123456 → "1,234.56". */
export function centsToEntry(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
