import { describe, expect, it } from 'vitest'
import {
  centsToEntry,
  digitsToCents,
  dollarsToCents,
  formatCents,
  formatSigned,
  parseAmount,
  MINUS,
} from './money'

describe('formatCents', () => {
  it('formats positive and negative amounts', () => {
    expect(formatCents(185_706)).toBe('$1,857.06')
    expect(formatCents(-28_644)).toBe(`${MINUS}$286.44`)
    expect(formatCents(0)).toBe('$0.00')
  })
})

describe('formatSigned', () => {
  it('always carries a sign except zero', () => {
    expect(formatSigned(165_000)).toBe('+$1,650.00')
    expect(formatSigned(-5432)).toBe(`${MINUS}$54.32`)
    expect(formatSigned(0)).toBe('$0.00')
  })
})

describe('parseAmount', () => {
  it('handles plain, formatted and partial input', () => {
    expect(parseAmount('54.32')).toBe(5432)
    expect(parseAmount('$1,650')).toBe(165_000)
    expect(parseAmount('1650.5')).toBe(165_050)
    expect(parseAmount('.5')).toBe(50)
  })

  it('rejects junk and non-positive amounts', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('1.2.3')).toBeNull()
  })
})

describe('digitsToCents (ATM-style entry)', () => {
  it('accumulates digits as cents from the right', () => {
    expect(digitsToCents('18')).toBe(18) // $0.18
    expect(digitsToCents('183')).toBe(183) // $1.83
    expect(digitsToCents('18300')).toBe(18_300) // $183.00
  })

  it('strips formatting and non-digits from re-rendered values', () => {
    expect(digitsToCents('1.83')).toBe(183)
    expect(digitsToCents('1,234.56')).toBe(123_456)
    expect(digitsToCents('abc')).toBeNull()
    expect(digitsToCents('')).toBeNull()
  })

  it('keeps zero distinct from empty', () => {
    expect(digitsToCents('0')).toBe(0)
  })
})

describe('centsToEntry', () => {
  it('renders the running cents display', () => {
    expect(centsToEntry(18)).toBe('0.18')
    expect(centsToEntry(183)).toBe('1.83')
    expect(centsToEntry(123_456)).toBe('1,234.56')
    expect(centsToEntry(5)).toBe('0.05')
  })

  it('round-trips with digitsToCents as the user types', () => {
    // simulate typing 1, 8, 3 with the display re-fed through the sanitizer
    let digits = ''
    for (const key of ['1', '8', '3']) {
      const display = digits ? centsToEntry(digitsToCents(digits)!) : ''
      digits = (display + key).replace(/\D/g, '')
    }
    expect(digitsToCents(digits)).toBe(183)
  })
})

describe('dollarsToCents', () => {
  it('rounds float artifacts from the Realm export', () => {
    expect(dollarsToCents(54.32)).toBe(5432)
    expect(dollarsToCents(0.1 + 0.2)).toBe(30)
    expect(dollarsToCents(-1450)).toBe(-145_000)
  })
})
