import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '../auth/AuthContext'

// Tracks the highest announcement id the member has SEEN (opened the Notices
// tab), per samithi. The tab badge is derived from ids above this watermark.
// seenId === null → not hydrated yet (show no badge rather than a wrong one).

const keyFor = (slug: string): string => `esamithi.noticesSeen.${slug.replace(/[^a-zA-Z0-9._-]/g, '_')}`

interface NoticesSeenValue {
  seenId: number | null
  markSeen: (maxId: number) => void
}

const NoticesSeenContext = createContext<NoticesSeenValue>({ seenId: null, markSeen: () => {} })

export function NoticesSeenProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { activeProfile } = useAuth()
  const slug = activeProfile?.slug
  const [seenId, setSeenId] = useState<number | null>(null)

  useEffect(() => {
    setSeenId(null)
    if (!slug) return
    SecureStore.getItemAsync(keyFor(slug))
      .then((v) => setSeenId(v ? Number(v) || 0 : 0))
      .catch(() => setSeenId(0))
  }, [slug])

  const markSeen = useCallback((maxId: number): void => {
    if (!slug) return
    setSeenId((prev) => {
      const next = Math.max(prev ?? 0, maxId)
      SecureStore.setItemAsync(keyFor(slug), String(next)).catch(() => {})
      return next
    })
  }, [slug])

  const value = useMemo(() => ({ seenId, markSeen }), [seenId, markSeen])
  return <NoticesSeenContext.Provider value={value}>{children}</NoticesSeenContext.Provider>
}

export function useNoticesSeen(): NoticesSeenValue {
  return useContext(NoticesSeenContext)
}
