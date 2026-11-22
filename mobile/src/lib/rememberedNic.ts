import * as SecureStore from 'expo-secure-store'

// The NIC a member last signed in with, per samithi, so a returning member
// only enters their PIN (redesign §6.1.5). Kept in SecureStore with the
// session; "Not you?" on the login screen forgets it.
const key = (slug: string | null | undefined): string => `esamithi.lastNic.${(slug || 'default').replace(/[^A-Za-z0-9._-]/g, '_')}`

export async function loadRememberedNic(slug: string | null | undefined): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key(slug))
  } catch {
    return null
  }
}

export function rememberNic(slug: string | null | undefined, nic: string): void {
  try {
    SecureStore.setItemAsync(key(slug), nic.trim().toUpperCase()).catch(() => {})
  } catch {
    // no secure storage (web preview): nothing to remember
  }
}

export function forgetNic(slug: string | null | undefined): void {
  try {
    SecureStore.deleteItemAsync(key(slug)).catch(() => {})
  } catch {
    // nothing stored
  }
}

export const maskNic = (nic: string): string => (nic.length > 4 ? `${'•'.repeat(Math.max(0, nic.length - 4))}${nic.slice(-4)}` : nic)
