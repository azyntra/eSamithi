// Search-param validators. TanStack Router calls these on every navigation,
// so they sit in the first load — hand-written, they keep Zod (and its ~35 KB)
// out of it, and Zod stays where it earns its place: form schemas, which load
// with their route. Each returns undefined for anything unexpected, which is
// the "catch to default" behaviour the URLs rely on: a hand-edited link must
// degrade to the default view, never crash the app.
export function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

export function int(v: unknown, min = 1): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isInteger(n) && n >= min ? n : undefined
}

export function oneOf<T extends string>(values: readonly T[]) {
  return (v: unknown): T | undefined => (typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : undefined)
}

export function oneOfNum<T extends number>(values: readonly T[]) {
  return (v: unknown): T | undefined => {
    const n = int(v)
    return n !== undefined && (values as readonly number[]).includes(n) ? (n as T) : undefined
  }
}

// YYYY-MM-DD only: the ledger's date filters are compared as strings
export function isoDate(v: unknown): string | undefined {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined
}

// A flag written as ?create=1 comes back as the number 1; a bookmark may
// carry the string, and either means on.
export function flag(v: unknown): 1 | undefined {
  return v === 1 || v === '1' || v === true ? 1 : undefined
}
export const FLAG_ON = 1 as const
