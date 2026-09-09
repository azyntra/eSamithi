import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const toneClass: Record<Tone, string> = {
  brand: 'bg-accent text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-muted text-muted-foreground'
}

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: Tone
  loading?: boolean
  index?: number
  className?: string
}

export function StatCard({ label, value, hint, icon, tone = 'brand', loading = false, index = 0, className }: StatCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.03, ease: [0, 0, 0, 1] }}>
      <Card className={cn('gap-3 px-5 py-4', className)}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          {icon ? <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&>svg]:size-[18px]', toneClass[tone])}>{icon}</span> : null}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <p className="tnum text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        )}
        {hint ? <p className="text-xs text-subtle-foreground">{hint}</p> : null}
      </Card>
    </motion.div>
  )
}
