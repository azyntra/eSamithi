import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMembersSlim } from '@/features/members/queries'
import { useT } from '@/lib/i18n'
import { matchesMember, memberLabel, memberSublabel } from '@/lib/members'
import { cn } from '@/lib/utils'

// Every member picker finds a member the same three ways — name, member ID
// or NIC — and shows "ID · NIC" under the name so namesakes can be told
// apart. The matching itself lives in lib/members so the command palette,
// the attendance roster and this picker cannot drift apart on what a
// nameless member does.
export { matchesMember, memberSublabel }

interface MemberPickerProps {
  value: number | null
  onChange: (id: number | null) => void
  exclude?: number[]
  placeholder?: string
  id?: string
  disabled?: boolean
  invalid?: boolean
  allowClear?: boolean
  className?: string
}

export function MemberPicker({ value, onChange, exclude = [], placeholder, id, disabled, invalid, allowClear = true, className }: MemberPickerProps) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const members = useMembersSlim()
  const options = useMemo(() => (members.data ?? []).filter((m) => !exclude.includes(m.id)), [members.data, exclude])
  const filtered = useMemo(() => options.filter((m) => matchesMember(m, query)).slice(0, 60), [options, query])
  const selected = options.find((m) => m.id === value) ?? (members.data ?? []).find((m) => m.id === value) ?? null

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery('') }}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn('h-9 w-full justify-between bg-card px-3 font-normal aria-invalid:border-destructive', !selected && 'text-subtle-foreground', className)}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-foreground">{memberLabel(selected, t('members.unnamed'))}</span>
              <span className="tnum truncate font-mono text-xs text-muted-foreground">{memberSublabel(selected)}</span>
            </span>
          ) : (
            <span className="truncate">{placeholder ?? t('lform.selectMember')}</span>
          )}
          <span className="flex shrink-0 items-center gap-1">
            {allowClear && selected && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label={t('common.close')}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(null)
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronsUpDown className="size-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={t('common.searchMember')} autoFocus />
          <CommandList>
            <CommandEmpty>{members.isPending ? t('common.loading') : t('common.noMatches')}</CommandEmpty>
            <CommandGroup>
              {filtered.map((m) => (
                <CommandItem
                  key={m.id}
                  value={String(m.id)}
                  onSelect={() => {
                    onChange(m.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-4', value === m.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{memberLabel(m, t('members.unnamed'))}</span>
                    <span className="tnum block truncate font-mono text-xs text-muted-foreground">{memberSublabel(m)}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
