import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll } from 'vitest'

// Component tests talk to a stand-in API rather than a real one. The client
// builds its URL from window.location.origin, which jsdom sets to localhost.
// Named mockApi rather than useMockApi: it is test plumbing, and anything
// starting with "use" is read as a React hook by the lint rules.
export const api = (path: string) => `http://localhost:3000/api/v1${path}`

export const server = setupServer()

export function mockApi(...handlers: Parameters<typeof server.use>) {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  beforeAll(() => server.use(...handlers))
  afterEach(() => server.resetHandlers(...handlers))
  afterAll(() => server.close())
}

export { http, HttpResponse }
