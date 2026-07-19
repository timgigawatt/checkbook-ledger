import { forwardRef, type CSSProperties } from 'react'
import { centsToEntry, digitsToCents } from '../lib/money'

/**
 * ATM-style money input: digits accumulate as cents from the right
 * ("183" reads as $1.83). Callers hold the raw digit string; typing a
 * minus fires onMinus so screens that allow negatives can flip the sign.
 */
export const AmountInput = forwardRef<
  HTMLInputElement,
  {
    digits: string
    onDigitsChange: (digits: string) => void
    onMinus?: () => void
    placeholder?: string
    autoFocus?: boolean
    className?: string
    style?: CSSProperties
    ariaLabel?: string
  }
>(function AmountInput(
  { digits, onDigitsChange, onMinus, placeholder = '0.00', autoFocus, className, style, ariaLabel },
  ref,
) {
  const cents = digitsToCents(digits)
  return (
    <input
      ref={ref}
      className={className}
      style={style}
      inputMode="numeric"
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={cents === null ? '' : centsToEntry(cents)}
      onChange={(e) => {
        if (e.target.value.includes('-')) onMinus?.()
        onDigitsChange(e.target.value.replace(/\D/g, '').slice(0, 12))
      }}
    />
  )
})
