// Holds the short-lived enrollment token between the verify-identity and
// set-pin screens. Kept in module memory (not navigation params) so it never
// appears in navigation state or logs.
let enrollToken: string | null = null

export function setEnrollToken(token: string | null): void {
  enrollToken = token
}

export function getEnrollToken(): string | null {
  return enrollToken
}
