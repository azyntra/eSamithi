import { useState, useEffect, useCallback } from 'react'
import { registerCache } from '../utils/cache'
import type { Member, MemberWithDependents, MemberFormData } from '../types'

interface MembersState {
  members: Member[]
  total: number
  loading: boolean
  page: number
  search: string
}

interface UseMembersReturn {
  state: MembersState
  setPage: (page: number) => void
  setSearch: (search: string) => void
  refresh: () => void
  getMember: (id: number) => Promise<MemberWithDependents>
  createMember: (data: MemberFormData) => Promise<{ success: boolean; id: number }>
  updateMember: (id: number, data: MemberFormData) => Promise<{ success: boolean }>
  deleteMember: (id: number) => Promise<{ success: boolean }>
  checkUnique: (field: string, value: string, excludeId?: number) => Promise<boolean>
}

const LIMIT = 15

// Module-level caches
const memberCache = new Map<number, { data: MemberWithDependents; timestamp: number }>()
const listCache = new Map<string, { members: Member[]; total: number; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 5 // 5 minutes

registerCache(() => {
  memberCache.clear()
  listCache.clear()
})

export function useMembers(): UseMembersReturn {
  const [state, setState] = useState<MembersState>({
    members: [],
    total: 0,
    loading: true,
    page: 1,
    search: ''
  })

  const fetchMembers = useCallback(async (forceRefresh = false) => {
    const cacheKey = `${state.search}_${state.page}`
    const cachedList = listCache.get(cacheKey)

    if (!forceRefresh && cachedList && Date.now() - cachedList.timestamp < CACHE_TTL) {
      setState((prev) => ({
        ...prev,
        members: cachedList.members,
        total: cachedList.total,
        loading: false
      }))
      return
    }

    setState((prev) => ({ ...prev, loading: true }))
    try {
      const result = await window.api.members.getAll({
        search: state.search,
        page: state.page,
        limit: LIMIT
      })
      listCache.set(cacheKey, { members: result.members, total: result.total, timestamp: Date.now() })
      setState((prev) => ({
        ...prev,
        members: result.members,
        total: result.total,
        loading: false
      }))
    } catch (error) {
      console.error('Failed to fetch members:', error)
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [state.search, state.page])

  // Debounce so typing in the search box doesn't fire a request per keystroke
  useEffect(() => {
    const timer = setTimeout(() => fetchMembers(), state.search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchMembers])

  const setPage = (page: number): void => {
    setState((prev) => ({ ...prev, page }))
  }

  const setSearch = (search: string): void => {
    setState((prev) => ({ ...prev, search, page: 1 }))
  }

  const refresh = (): void => {
    listCache.clear()
    fetchMembers(true)
  }

  const getMember = async (id: number): Promise<MemberWithDependents> => {
    const cached = memberCache.get(id)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
    const data = await window.api.members.getById(id)
    memberCache.set(id, { data, timestamp: Date.now() })
    return data
  }

  const createMember = async (
    data: MemberFormData
  ): Promise<{ success: boolean; id: number }> => {
    const result = await window.api.members.create(data)
    if (result.success) {
      listCache.clear()
    }
    return result
  }

  const updateMember = async (
    id: number,
    data: MemberFormData
  ): Promise<{ success: boolean }> => {
    const result = await window.api.members.update(id, data)
    if (result.success) {
      memberCache.delete(id)
      listCache.clear()
    }
    return result
  }

  const deleteMember = async (id: number): Promise<{ success: boolean }> => {
    const result = await window.api.members.delete(id)
    if (result.success) {
      memberCache.delete(id)
      listCache.clear()
    }
    return result
  }

  const checkUnique = async (
    field: string,
    value: string,
    excludeId?: number
  ): Promise<boolean> => {
    return window.api.members.checkUnique(field, value, excludeId)
  }

  return {
    state,
    setPage,
    setSearch,
    refresh,
    getMember,
    createMember,
    updateMember,
    deleteMember,
    checkUnique
  }
}
