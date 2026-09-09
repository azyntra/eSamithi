export class ApiError extends Error {
  status: number
  code: string | null
  body: unknown

  constructor(status: number, message: string, body: unknown = null, code: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (isApiError(e)) return e.message || fallback
  if (e instanceof Error) return e.message || fallback
  return fallback
}
