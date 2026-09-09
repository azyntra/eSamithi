import { ApiError } from './errors'
import { apiFetch } from './session'

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text()
  const body = text ? (JSON.parse(text) as unknown) : null
  if (!res.ok) {
    const err = (body as { error?: string; code?: string } | null) ?? {}
    throw new ApiError(res.status, err.error || `Request failed (${res.status})`, body, err.code ?? null)
  }
  return body as T
}

function qs(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | null | undefined>) =>
    apiFetch(`${path}${qs(params)}`).then((r) => parse<T>(r)),
  post: <T>(path: string, body?: unknown) =>
    apiFetch(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => parse<T>(r)),
  put: <T>(path: string, body?: unknown) =>
    apiFetch(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => parse<T>(r)),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => parse<T>(r)),
  delete: <T>(path: string) => apiFetch(path, { method: 'DELETE' }).then((r) => parse<T>(r))
}
