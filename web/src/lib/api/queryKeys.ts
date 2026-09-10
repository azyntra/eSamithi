// Query keys per feature (requirements §6.8). Lists take their filter object
// so a mutation can invalidate every page/filter with the bare prefix.
export const qk = {
  dashboard: ['dashboard'] as const,
  health: ['health'] as const,
  members: (filters?: object) => (filters ? (['members', filters] as const) : (['members'] as const)),
  member: (id: number) => ['member', id] as const,
  memberStatement: (id: number) => ['member-statement', id] as const,
  membersSlim: ['members-slim'] as const,
  income: (filters?: object) => (filters ? (['income', filters] as const) : (['income'] as const)),
  expenses: (filters?: object) => (filters ? (['expenses', filters] as const) : (['expenses'] as const)),
  incomeTypes: ['income-types'] as const,
  expenseTypes: ['expense-types'] as const,
  wallets: ['wallets'] as const,
  fds: ['fds'] as const,
  assets: ['assets'] as const,
  settings: ['settings'] as const,
  users: ['users'] as const,
  loans: ['loans'] as const,
  reports: (kind: string, params: object) => ['reports', kind, params] as const,
  loan: (id: number) => ['loan', id] as const,
  events: ['events'] as const,
  eventAttendance: (id: number) => ['event-attendance', id] as const,
  announcements: ['announcements'] as const,
  memberRequests: (status?: string) => (status ? (['member-requests', status] as const) : (['member-requests'] as const)),
  purukaPosts: (filters?: object) => (filters ? (['puruka-posts', filters] as const) : (['puruka-posts'] as const)),
  purukaCategories: ['puruka-categories'] as const
}
