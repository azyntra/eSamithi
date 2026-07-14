// Web workspace shim: reproduces the Electron `window.api` bridge with fetch
// calls to the tenant API, using the impersonation token the super-admin panel
// handed off. The same desktop renderer thus runs in the browser with full
// staff functionality (super-admin panel FR-5.2). Session context lives in
// sessionStorage so it survives reloads but not new tabs.
export interface WorkspaceSession {
  token: string
  apiUrl: string
  slug: string
  name: string
  sid: string
  expiresAt: string
  actorEmail: string
}

const KEY = 'esamithi.workspace'

export function loadSession(): WorkspaceSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as WorkspaceSession) : null
  } catch {
    return null
  }
}

export function saveSession(s: WorkspaceSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(s))
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY)
}

// Bounce back to the panel when the support session ends
function endSession(): void {
  clearSession()
  window.location.href = '/admin/'
}

export function installShim(session: WorkspaceSession): void {
  // Avoid mixed content: if the console is served over HTTPS but the samithi's
  // registry api_url is plain HTTP (same single-server setup), call the API
  // same-origin over HTTPS instead. The X-Samithi header still routes to the
  // right tenant, so this reaches the same API container.
  const apiBase =
    window.location.protocol === 'https:' && session.apiUrl.startsWith('http://')
      ? `${window.location.origin}/api/v1`
      : session.apiUrl

  async function req(method: string, path: string, body?: unknown, params?: Record<string, unknown>): Promise<any> {
    let url = apiBase + path
    if (params) {
      const q = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) q.append(k, String(v))
      const s = q.toString()
      if (s) url += '?' + s
    }
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        'X-Samithi': session.slug
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401 && /support session|expired/i.test(data.error || '')) endSession()
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
    return data
  }
  const get = (p: string, params?: Record<string, unknown>) => req('GET', p, undefined, params)
  const post = (p: string, b?: unknown) => req('POST', p, b)
  const put = (p: string, b?: unknown) => req('PUT', p, b)
  const patch = (p: string, b?: unknown) => req('PATCH', p, b)
  const del = (p: string) => req('DELETE', p)

  const api = {
    auth: {
      // Already authenticated via the impersonation token — echo the actor
      login: async () => ({ success: true, user: { id: 0, username: session.actorEmail, full_name: `eSamithi Support`, role: 'admin' } }),
      logout: async () => { endSession(); return { success: true } },
      onSessionExpired: (cb: () => void) => { void cb; return () => {} }
    },
    setup: {
      getState: async () => ({ configured: true, code: null, name: session.name, api_url: session.apiUrl }),
      resolve: async () => { throw new Error('Not available in the support workspace') }
    },
    network: { ping: async () => true, onOffline: () => () => {}, onOnline: () => () => {} },
    users: {
      getAll: () => get('/users'),
      create: (d: any) => post('/users', d),
      delete: (id: number) => del(`/users/${id}`)
    },
    members: {
      getAll: (params: any) => get('/members', params),
      getAllSlim: () => get('/members/slim'),
      getById: (id: number) => get(`/members/${id}`),
      create: (d: any) => post('/members', d),
      update: (id: number, d: any) => put(`/members/${id}`, d),
      delete: (id: number) => del(`/members/${id}`),
      getStatement: (id: number) => get(`/members/${id}/statement`),
      setAppAccess: (id: number, d: any) => put(`/members/${id}/app-access`, d),
      checkUnique: (field: string, value: string, excludeId?: number) => get('/members/check-unique', { field, value, excludeId })
    },
    announcements: {
      getAll: () => get('/announcements'),
      create: (d: any) => post('/announcements', d),
      update: (id: number, d: any) => put(`/announcements/${id}`, d),
      toggle: (id: number) => patch(`/announcements/${id}/toggle`),
      delete: (id: number) => del(`/announcements/${id}`)
    },
    memberRequests: {
      getAll: (status?: string) => get('/member-requests', status ? { status } : undefined),
      review: (id: number, d: any) => patch(`/member-requests/${id}`, d)
    },
    events: {
      getAll: () => get('/events'),
      create: (d: any) => post('/events', d),
      delete: (id: number) => del(`/events/${id}`),
      getAttendance: (id: number) => get(`/events/${id}/attendance`),
      mark: (id: number, societyId: string) => post(`/events/${id}/attendance`, { society_id: societyId }),
      unmark: (id: number, memberId: number) => del(`/events/${id}/attendance/${memberId}`)
    },
    puruka: {
      getAll: (params?: any) => get('/puruka-admin', params),
      deactivate: (id: number) => patch(`/puruka-admin/${id}/deactivate`),
      reactivate: (id: number) => patch(`/puruka-admin/${id}/reactivate`),
      getCategories: () => get('/puruka-admin/categories'),
      createCategory: (d: any) => post('/puruka-admin/categories', d),
      updateCategory: (id: number, d: any) => patch(`/puruka-admin/categories/${id}`, d)
    },
    wallets: {
      getAll: () => get('/wallets'),
      create: (d: any) => post('/wallets', d),
      update: (id: number, d: any) => put(`/wallets/${id}`, d),
      toggleActive: (id: number) => patch(`/wallets/${id}/toggle`),
      transfer: (fromId: number, toId: number, amount: number) => post('/wallets/transfer', { fromId, toId, amount }),
      deposit: (id: number, amount: number, note: string) => post(`/wallets/${id}/deposit`, { amount, note }),
      delete: (id: number) => del(`/wallets/${id}`)
    },
    fixedDeposits: {
      getAll: () => get('/fixed-deposits'),
      create: (d: any) => post('/fixed-deposits', d),
      update: (id: number, d: any) => put(`/fixed-deposits/${id}`, d),
      withdraw: (id: number) => patch(`/fixed-deposits/${id}/withdraw`)
    },
    assets: {
      getAll: () => get('/assets'),
      create: (d: any) => post('/assets', d),
      update: (id: number, d: any) => put(`/assets/${id}`, d),
      delete: (id: number) => del(`/assets/${id}`)
    },
    settings: {
      getAll: () => get('/settings'),
      updateBulk: (updates: Record<string, string>) => put('/settings', updates)
    },
    incomeTypes: {
      getAll: () => get('/income-types'),
      create: (d: any) => post('/income-types', d),
      update: (id: number, d: any) => put(`/income-types/${id}`, d),
      delete: (id: number) => del(`/income-types/${id}`)
    },
    expenseTypes: {
      getAll: () => get('/expense-types'),
      create: (d: any) => post('/expense-types', d),
      update: (id: number, d: any) => put(`/expense-types/${id}`, d),
      delete: (id: number) => del(`/expense-types/${id}`)
    },
    income: {
      getAll: (params?: any) => get('/income', params),
      create: (d: any) => post('/income', d),
      void: (id: number, reason: string) => patch(`/income/${id}/void`, { reason }),
      delete: (id: number) => del(`/income/${id}`)
    },
    expenses: {
      getAll: (params?: any) => get('/expenses', params),
      create: (d: any) => post('/expenses', d),
      void: (id: number, reason: string) => patch(`/expenses/${id}/void`, { reason }),
      delete: (id: number) => del(`/expenses/${id}`)
    },
    loans: {
      getAll: () => get('/loans'),
      getById: (id: number) => get(`/loans/${id}`),
      issue: (d: any) => post('/loans', d),
      repay: (id: number, d: any) => post(`/loans/${id}/repay`, d),
      migrate: (d: any) => post('/loans/migrate', d),
      getPayments: (id: number) => get(`/loans/${id}/payments`),
      delete: (id: number) => del(`/loans/${id}`)
    },
    dashboard: { getStats: () => get('/dashboard/stats') },
    reports: {
      monthly: (year: number, month: number) => get('/reports/monthly', { year, month }),
      annual: (year: number) => get('/reports/annual', { year }),
      arrears: () => get('/reports/arrears')
    },
    exporter: {
      // Browser download instead of a native save dialog
      csv: async (defaultFilename: string, csvContent: string) => {
        const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultFilename
        a.click()
        URL.revokeObjectURL(url)
        return { success: true, path: defaultFilename }
      }
    },
    updater: {
      checkForUpdates: async () => ({ available: false }),
      downloadUpdate: async () => ({}),
      installUpdate: async () => ({}),
      onUpdateEvent: () => () => {},
      getVersion: async () => 'workspace'
    }
  }

  ;(window as unknown as { api: unknown }).api = api
}
