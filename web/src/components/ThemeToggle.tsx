import { MoonStar, SunMedium } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useT } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useT()
  const [theme, setTheme] = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = t(next === 'light' ? 'theme.light' : 'theme.dark')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label={label} onClick={() => setTheme(next)}>
          {theme === 'dark' ? <SunMedium /> : <MoonStar />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
