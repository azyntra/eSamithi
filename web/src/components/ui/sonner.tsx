import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/lib/theme'

function Toaster(props: ToasterProps) {
  const [theme] = useTheme()
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{ duration: 3000, classNames: { toast: 'font-sans! rounded-xl! shadow-lg!' } }}
      style={{ '--normal-bg': 'var(--popover)', '--normal-text': 'var(--popover-foreground)', '--normal-border': 'var(--border)' } as React.CSSProperties}
      {...props}
    />
  )
}

export { Toaster }
