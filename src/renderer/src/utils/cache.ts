// Central registry for the module-level data caches used by the hooks.
// Hooks register a clear function at module load; logout and session expiry
// call clearAllCaches() so no data leaks across user sessions.
//
// Caches may also register a `key` so one module's mutation can invalidate
// another module's cache — e.g. recording income changes a wallet balance,
// so it must invalidate the 'wallets' and 'dashboard' caches even though
// those pages aren't mounted at the time.
const clearFns: Array<{ key: string; fn: () => void }> = []

export function registerCache(clearFn: () => void, key = ''): void {
  clearFns.push({ key, fn: clearFn })
}

export function clearAllCaches(): void {
  for (const { fn } of clearFns) fn()
}

// Clear only the caches registered under the given keys, forcing those
// modules to refetch the next time they mount.
export function invalidateCaches(...keys: string[]): void {
  for (const { key, fn } of clearFns) {
    if (key && keys.includes(key)) fn()
  }
}
