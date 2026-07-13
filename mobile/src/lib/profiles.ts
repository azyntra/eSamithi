import axios from 'axios'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

// Multi-samithi profiles (plan §2.6): a member can enroll in several
// samithis. Each profile is a resolved { code, slug, name, apiUrl }; refresh
// tokens are stored per samithi so switching is silent while sessions last.
export interface SamithiProfile {
  code: string
  slug: string
  name: string
  apiUrl: string
}

const extra = (Constants.expoConfig?.extra ?? {}) as { directoryUrl?: string }
export const DIRECTORY_URL: string = extra.directoryUrl ?? 'http://212.227.103.150/directory'

const PROFILES_KEY = 'esamithi.profiles'
const ACTIVE_KEY = 'esamithi.activeSlug'

export function refreshTokenKey(slug: string): string {
  return `esamithi.${slug}.refreshToken`
}

export async function loadProfiles(): Promise<SamithiProfile[]> {
  try {
    const raw = await SecureStore.getItemAsync(PROFILES_KEY)
    return raw ? (JSON.parse(raw) as SamithiProfile[]) : []
  } catch {
    return []
  }
}

async function saveProfiles(list: SamithiProfile[]): Promise<void> {
  await SecureStore.setItemAsync(PROFILES_KEY, JSON.stringify(list))
}

export async function upsertProfile(profile: SamithiProfile): Promise<SamithiProfile[]> {
  const list = await loadProfiles()
  const next = [...list.filter((p) => p.slug !== profile.slug), profile]
  await saveProfiles(next)
  return next
}

export async function getActiveSlug(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACTIVE_KEY)
  } catch {
    return null
  }
}

export async function setActiveSlugStored(slug: string | null): Promise<void> {
  if (slug) await SecureStore.setItemAsync(ACTIVE_KEY, slug)
  else await SecureStore.deleteItemAsync(ACTIVE_KEY).catch(() => {})
}

// Resolve a samithi join code via the directory service. Errors carry a
// `kind` the screens map to translated messages.
export type ResolveErrorKind = 'unknown' | 'inactive' | 'network'

export async function resolveSamithiCode(code: string): Promise<SamithiProfile> {
  const clean = String(code || '').trim().toUpperCase()
  try {
    const res = await axios.get(`${DIRECTORY_URL}/v1/resolve/${encodeURIComponent(clean)}`, { timeout: 10000 })
    const record = res.data as { slug: string; name: string; api_url: string; status: string }
    if (record.status !== 'active') {
      throw Object.assign(new Error('samithi inactive'), { kind: 'inactive' as ResolveErrorKind })
    }
    return { code: clean, slug: record.slug, name: record.name, apiUrl: record.api_url }
  } catch (err) {
    if ((err as { kind?: string }).kind) throw err
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      throw Object.assign(new Error('unknown code'), { kind: 'unknown' as ResolveErrorKind })
    }
    throw Object.assign(new Error('directory unreachable'), { kind: 'network' as ResolveErrorKind })
  }
}
