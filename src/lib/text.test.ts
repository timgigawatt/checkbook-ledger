import { describe, expect, it } from 'vitest'
import { titleCase } from './text'

describe('titleCase', () => {
  it('capitalizes the first letter of every word', () => {
    expect(titleCase('quik trip gas')).toBe('Quik Trip Gas')
  })

  it('leaves apostrophes inside a word alone', () => {
    expect(titleCase("mcdonald's coffee")).toBe("Mcdonald's Coffee")
    expect(titleCase("trader joe’s")).toBe('Trader Joe’s')
  })

  it('preserves deliberate mixed case', () => {
    expect(titleCase("McDonald's")).toBe("McDonald's")
    expect(titleCase('AT&T store')).toBe('AT&T Store')
  })

  it('treats hyphens and slashes as word starts', () => {
    expect(titleCase('7-eleven')).toBe('7-Eleven')
    expect(titleCase('am/pm market')).toBe('Am/Pm Market')
  })

  it('is stable while typing', () => {
    expect(titleCase(titleCase('half fin'))).toBe('Half Fin')
    expect(titleCase('')).toBe('')
  })
})
