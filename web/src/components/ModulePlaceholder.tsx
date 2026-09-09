import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { useT, type TranslationKey } from '@/lib/i18n'

export function ModulePlaceholder({ titleKey, phase }: { titleKey: TranslationKey; phase: 1 | 2 }) {
  const { t } = useT()
  return (
    <>
      <PageHeader title={t(titleKey)} />
      <EmptyState icon={<Construction />} title={t('placeholder.title')} description={t('placeholder.body', { phase })} />
    </>
  )
}
