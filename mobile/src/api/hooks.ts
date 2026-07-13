import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// ── Server response shapes (cents everywhere, dates as YYYY-MM-DD) ──
export interface Dependent {
  name: string | null
  relationship: string | null
  date_of_birth: string | null
  age: number | null
}

export interface Profile {
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
  bank_name: string | null
  bank_account_holder_name: string | null
  bank_account_number: string | null
  is_active: number
  dependents: Dependent[]
}

export interface LedgerRow {
  id: number
  date: string
  amount: number
  status: string
  payment_method: string
  loan_id?: number | null
  type_name: string
  type_code: string | null
}

export interface StatementLoan {
  id: number
  principal_amount: number
  principal_owed: number
  interest_owed: number
  fines_owed: number
  date_issued: string
  status: string
  is_migrated: number
}

export interface Guarantee {
  id: number
  date_issued: string
  status: string
  borrower_name: string
}

export interface Statement {
  income: LedgerRow[]
  expenses: LedgerRow[]
  loans: StatementLoan[]
  guarantees: Guarantee[]
}

export interface Dues {
  overdue_loans: Array<{ id: number; principal_owed: number; interest_owed: number; fines_owed: number }>
  membership_fee_paid: boolean | null
}

export interface LoanPayment {
  id: number
  date: string
  principal_paid: number
  interest_paid: number
  fines_paid: number
}

export interface LoanDetail extends StatementLoan {
  purpose: string | null
  guarantors: string[]
  payments: LoanPayment[]
}

export interface BenefitType {
  name: string
  code: string | null
  standard_payout: number
}

export interface SocietyInfo {
  society_name: string | null
  monthly_interest_rate: string | null
  late_fine_rate: string | null
  required_guarantors: string | null
  max_loan_limit: string | null
  society_phone?: string | null
  society_address?: string | null
}

export interface Announcement {
  id: number
  type: 'death' | 'meeting' | 'general'
  title: string
  body: string | null
  deceased_name: string | null
  funeral_date: string | null
  funeral_location: string | null
  event_date: string | null
  created_at: string
}

export interface MemberRequest {
  id: number
  type: 'loan' | 'correction'
  amount: number | null
  purpose: string | null
  message: string | null
  status: 'Pending' | 'Approved' | 'Rejected' | 'Done'
  staff_note: string | null
  created_at: string
}

export interface NewRequest {
  type: 'loan' | 'correction'
  amount?: number
  purpose?: string
  message?: string
}

const STALE_MS = 60 * 1000
// Screens showing data that staff change from the desktop poll while open and
// in the foreground; refetchIntervalInBackground stays false (the default) so
// polling pauses when the app is backgrounded (see lib/queryFocus).
const LIVE_POLL_MS = 45 * 1000

export function useProfile() {
  return useQuery({
    queryKey: ['me', 'profile'],
    queryFn: async () => (await api.get<Profile>('/me/profile')).data,
    staleTime: STALE_MS
  })
}

export function useStatement() {
  return useQuery({
    queryKey: ['me', 'statement'],
    queryFn: async () => (await api.get<Statement>('/me/statement')).data,
    staleTime: STALE_MS,
    refetchInterval: LIVE_POLL_MS
  })
}

export function useDues() {
  return useQuery({
    queryKey: ['me', 'dues'],
    queryFn: async () => (await api.get<Dues>('/me/dues')).data,
    staleTime: STALE_MS,
    refetchInterval: LIVE_POLL_MS
  })
}

export function useLoan(id: number) {
  return useQuery({
    queryKey: ['me', 'loan', id],
    queryFn: async () => (await api.get<LoanDetail>(`/me/loans/${id}`)).data,
    staleTime: STALE_MS,
    enabled: Number.isFinite(id)
  })
}

export function useBenefitsSchedule() {
  return useQuery({
    queryKey: ['me', 'benefits'],
    queryFn: async () => (await api.get<BenefitType[]>('/me/benefits-schedule')).data,
    staleTime: 10 * 60 * 1000
  })
}

export function useSocietyInfo() {
  return useQuery({
    queryKey: ['me', 'society'],
    queryFn: async () => (await api.get<SocietyInfo>('/me/society-info')).data,
    staleTime: 10 * 60 * 1000
  })
}

export interface SocietyFundFD {
  id: number
  bank_name: string | null
  fd_number: string | null
  principal: number
  interest_rate: number | null
  maturity_date: string | null
}

export interface SocietyFunds {
  total_funds: number
  cash_total: number
  fd_total: number
  fixed_deposits: SocietyFundFD[]
}

export function useSocietyFunds() {
  return useQuery({
    queryKey: ['me', 'society-funds'],
    queryFn: async () => (await api.get<SocietyFunds>('/me/society-funds')).data,
    staleTime: STALE_MS
  })
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ['me', 'announcements'],
    queryFn: async () => (await api.get<Announcement[]>('/me/announcements')).data,
    staleTime: STALE_MS,
    refetchInterval: LIVE_POLL_MS
  })
}

export function useMyRequests() {
  return useQuery({
    queryKey: ['me', 'requests'],
    queryFn: async () => (await api.get<MemberRequest[]>('/me/requests')).data,
    staleTime: STALE_MS
  })
}

export function useCreateRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: NewRequest) => (await api.post('/me/requests', data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'requests'] })
  })
}


// ── Puruka (community exchange platform) ─────────────────────────
export interface PurukaCategory {
  id: number
  code: string
  label_en: string
  label_si: string
}

export type PurukaStatus = 'Active' | 'Sold' | 'Inactive' | 'Removed' | 'Deleted'

export interface PurukaPost {
  id: number
  member_id: number
  category_id: number
  category_code: string
  category_en: string
  category_si: string
  title: string
  description: string | null
  price: number | null
  negotiable: 0 | 1
  phone: string | null
  location: string | null
  status: PurukaStatus
  created_at: string
  expires_at?: string
  seller_name?: string
  seller_since?: string
  photos: string[] // server-relative paths; render via photoUrl()
  is_owner?: boolean
}

export interface PurukaFeedPage {
  items: PurukaPost[]
  page: number
  has_more: boolean
}

export interface PurukaFilters {
  category: number | 'all'
  q: string
  location: string
  minPrice: number | null // cents
  maxPrice: number | null // cents
  avail: 'all' | 'available' | 'sold'
}

export interface NewPurukaPost {
  title: string
  category_id: number
  description: string
  price: number | null // cents
  negotiable: boolean
  phone: string
  location: string
  photoUris: string[] // local file:// URIs, already compressed
}

export function usePurukaCategories() {
  return useQuery({
    queryKey: ['puruka', 'categories'],
    queryFn: async () => (await api.get<PurukaCategory[]>('/puruka/categories')).data,
    staleTime: 10 * 60 * 1000
  })
}

export function usePurukaFeed(filters: PurukaFilters) {
  return useInfiniteQuery({
    queryKey: ['puruka', 'feed', filters],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { page: pageParam }
      if (filters.category !== 'all') params.category = filters.category
      if (filters.q.trim()) params.q = filters.q.trim()
      if (filters.location.trim()) params.location = filters.location.trim()
      if (filters.minPrice !== null) params.min_price = filters.minPrice
      if (filters.maxPrice !== null) params.max_price = filters.maxPrice
      if (filters.avail !== 'all') params.avail = filters.avail
      return (await api.get<PurukaFeedPage>('/puruka', { params })).data
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: STALE_MS,
    refetchInterval: LIVE_POLL_MS
  })
}

export function usePurukaPost(id: number) {
  return useQuery({
    queryKey: ['puruka', 'post', id],
    queryFn: async () => (await api.get<PurukaPost>(`/puruka/${id}`)).data,
    staleTime: STALE_MS,
    enabled: Number.isFinite(id)
  })
}

export function useMyPurukaPosts() {
  return useQuery({
    queryKey: ['puruka', 'mine'],
    queryFn: async () => (await api.get<PurukaPost[]>('/puruka/mine')).data,
    staleTime: STALE_MS
  })
}

function invalidatePuruka(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: ['puruka'] })
}

export function useCreatePurukaPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: NewPurukaPost) => {
      const form = new FormData()
      form.append('title', data.title)
      form.append('category_id', String(data.category_id))
      form.append('description', data.description)
      if (data.price !== null) form.append('price', String(data.price))
      form.append('negotiable', data.negotiable ? '1' : '0')
      form.append('phone', data.phone)
      form.append('location', data.location)
      data.photoUris.forEach((uri, i) => {
        // React Native FormData file part: { uri, name, type }
        form.append('photos', { uri, name: `photo${i}.jpg`, type: 'image/jpeg' } as unknown as Blob)
      })
      return (await api.post('/puruka', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      })).data
    },
    onSuccess: () => invalidatePuruka(queryClient)
  })
}

export function useUpdatePurukaPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: {
      id: number
      data: { action: 'sold' | 'available' | 'renew' | 'deactivate' } | Record<string, unknown>
    }) => (await api.patch(`/puruka/${id}`, data)).data,
    onSuccess: () => invalidatePuruka(queryClient)
  })
}

export function useDeletePurukaPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/puruka/${id}`)).data,
    onSuccess: () => invalidatePuruka(queryClient)
  })
}

export function useReportPurukaPost() {
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      (await api.post(`/puruka/${id}/report`, { reason })).data
  })
}
