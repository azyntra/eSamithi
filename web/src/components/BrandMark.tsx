import { cn } from '@/lib/utils'

// The eS squircle from the app icon: 135° gradient, white "eS", Inter 800.
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('bg-brand-gradient grid shrink-0 select-none place-items-center font-extrabold text-white shadow-md', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), fontSize: Math.round(size * 0.46), letterSpacing: '-0.02em', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      eS
    </div>
  )
}
