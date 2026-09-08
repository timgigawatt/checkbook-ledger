/**
 * Uppercase the first letter of each word, leaving everything else as
 * typed: "mcdonald's coffee" → "Mcdonald's Coffee", "McDonald's" survives.
 * Apostrophes don't start a new word; any other non-letter does.
 */
export function titleCase(s: string): string {
  return s.replace(
    /(^|[^\p{L}'’])(\p{Ll})/gu,
    (_match, boundary: string, letter: string) => boundary + letter.toUpperCase(),
  )
}
