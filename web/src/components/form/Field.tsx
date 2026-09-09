import { useId, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: ReactNode
  htmlFor?: string
  required?: boolean
  error?: string | null
  description?: ReactNode
  className?: string
  children: ReactNode | ((ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode)
}

// Label + control + hint/error, with the aria wiring done once.
export function Field({ label, htmlFor, required, error, description, className, children }: FieldProps) {
  const auto = useId()
  const id = htmlFor ?? auto
  const errId = `${id}-error`
  const descId = `${id}-desc`
  const describedBy = [error ? errId : null, description ? descId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-danger" aria-hidden> *</span> : null}
      </Label>
      {typeof children === 'function' ? children({ id, describedBy, invalid: Boolean(error) }) : children}
      {description && !error ? (
        <p id={descId} className="text-xs text-subtle-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function FormSection({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('grid gap-4', className)}>
      <h3 className="border-b border-border pb-2 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}
