import { describe, expect, it } from 'vitest'
import { dollarsToCents, formatCents, formatSigned, parseAmount, MINUS } from './money'

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

describe('dollarsToCents', () => {
  it('rounds float artifacts from the Realm export', () => {
    expect(dollarsToCents(54.32)).toBe(5432)
    expect(dollarsToCents(0.1 + 0.2)).toBe(30)
    expect(dollarsToCents(-1450)).toBe(-145_000)
  })
})
