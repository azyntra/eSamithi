import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'
import { initTheme } from './utils/theme'

initTheme()

// ── Browser Dev Mode Mock ────────────────────────────────────────
// When running in a browser (not Electron), window.api is undefined.
// Inject an in-memory mock so the UI can be fully tested.
if (!window.api) {
  interface MockMember {
    id: number
    society_id: string
    nic: string
    full_name: string
    date_of_birth: string
    gender: string
    marital_status: string
    occupation: string | null
    address: string | null
    phone: string
    date_of_joining: string
    father_name: string | null
    mother_name: string | null
    father_in_law_name: string | null
    mother_in_law_name: string | null
    bank_name: string | null
    bank_account_holder_name: string | null
    bank_account_number: string | null
    created_at: string
    [key: string]: unknown
  }

  interface MockDependent {
    id: number
    member_id: number
    name: string
    relationship: string
  }

  let nextMemberId = 1
  let nextDepId = 1
  const members: MockMember[] = []
  const dependents: MockDependent[] = []

  interface MockUser {
    id: number
    username: string
    password: string
    full_name: string
    role: string
  }

  let nextUserId = 2
  const mockUsers: MockUser[] = [
    { id: 1, username: 'admin', password: 'admin123', full_name: 'Administrator', role: 'admin' }
  ]

  // Partial mock — only the areas testable in a browser are implemented
  window.api = {
    auth: {
      login: async (username: string, password: string) => {
        const u = mockUsers.find((u) => u.username === username && u.password === password)
        if (u) {
          return { success: true, user: { id: u.id, username: u.username, full_name: u.full_name, role: u.role } }
        }
        throw new Error('Invalid username or password')
      }
    },
    users: {
      getAll: async () => {
        return mockUsers.map((u) => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role }))
      },
      create: async (data: { username: string; password: string; full_name: string; role: string }) => {
        if (mockUsers.some((u) => u.username === data.username)) throw new Error('Username already exists')
        const id = nextUserId++
        mockUsers.push({ id, ...data })
        return { success: true, id }
      },
      delete: async (id: number) => {
        const idx = mockUsers.findIndex((u) => u.id === id)
        if (idx !== -1) mockUsers.splice(idx, 1)
        return { success: true }
      }
    },
    members: {
      getAllSlim: async () => {
        return members.map((m) => ({ id: m.id, nic: m.nic, full_name: m.full_name }))
      },
      getAll: async ({ search = '', page = 1, limit = 15 }) => {
        let filtered = members
        if (search.trim()) {
          const s = search.toLowerCase()
          filtered = members.filter(
            (m) =>
              m.full_name.toLowerCase().includes(s) ||
              m.nic.toLowerCase().includes(s) ||
              m.society_id.toLowerCase().includes(s)
          )
        }
        const total = filtered.length
        const start = (page - 1) * limit
        return { members: filtered.slice(start, start + limit), total }
      },
      getById: async (id: number) => {
        const m = members.find((m) => m.id === id)
        if (!m) throw new Error('Member not found')
        const deps = dependents.filter((d) => d.member_id === id)
        return { ...m, dependents: deps }
      },
      create: async (data: any) => {
        const id = nextMemberId++
        members.unshift({
          id,
          society_id: data.society_id,
          nic: data.nic,
          full_name: data.full_name,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          marital_status: data.marital_status,
          occupation: data.occupation || null,
          address: data.address || null,
          phone: data.phone,
          date_of_joining: data.date_of_joining,
          father_name: data.father_name || null,
          mother_name: data.mother_name || null,
          father_in_law_name: data.father_in_law_name || null,
          mother_in_law_name: data.mother_in_law_name || null,
          bank_name: data.bank_name || null,
          bank_account_holder_name: data.bank_account_holder_name || null,
          bank_account_number: data.bank_account_number || null,
          created_at: new Date().toISOString()
        })
        for (const dep of data.dependents) {
          if (dep.name.trim() && dep.relationship.trim()) {
            dependents.push({ id: nextDepId++, member_id: id, name: dep.name, relationship: dep.relationship })
          }
        }
        return { success: true, id }
      },
      update: async (id: number, data: any) => {
        const idx = members.findIndex((m) => m.id === id)
        if (idx === -1) throw new Error('Member not found')
        members[idx] = {
          ...members[idx],
          society_id: data.society_id,
          nic: data.nic,
          full_name: data.full_name,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          marital_status: data.marital_status,
          occupation: data.occupation || null,
          address: data.address || null,
          phone: data.phone,
          date_of_joining: data.date_of_joining,
          father_name: data.father_name || null,
          mother_name: data.mother_name || null,
          father_in_law_name: data.father_in_law_name || null,
          mother_in_law_name: data.mother_in_law_name || null,
          bank_name: data.bank_name || null,
          bank_account_holder_name: data.bank_account_holder_name || null,
          bank_account_number: data.bank_account_number || null
        }
        // Replace dependents
        const depIdxs = dependents.reduce<number[]>((acc, d, i) => (d.member_id === id ? [...acc, i] : acc), [])
        depIdxs.reverse().forEach((i) => dependents.splice(i, 1))
        for (const dep of data.dependents) {
          if (dep.name.trim() && dep.relationship.trim()) {
            dependents.push({ id: nextDepId++, member_id: id, name: dep.name, relationship: dep.relationship })
          }
        }
        return { success: true }
      },
      delete: async (id: number) => {
        const idx = members.findIndex((m) => m.id === id)
        if (idx !== -1) members.splice(idx, 1)
        const depIdxs = dependents.reduce<number[]>((acc, d, i) => (d.member_id === id ? [...acc, i] : acc), [])
        depIdxs.reverse().forEach((i) => dependents.splice(i, 1))
        return { success: true }
      },
      checkUnique: async (field: string, value: string, excludeId?: number) => {
        return !members.some(
          (m) => (m as Record<string, unknown>)[field] === value && m.id !== excludeId
        )
      }
    }
  } as typeof window.api
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    console.error("Uncaught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#f8d7da', color: '#721c24', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Click for error details</summary>
            <br />
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
