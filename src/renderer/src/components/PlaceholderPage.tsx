import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { useT } from '../i18n'

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
}

export default function PlaceholderPage({ icon: Icon, title }: PlaceholderPageProps): React.ReactElement {
  const { t } = useT()
  return (
    <div className="placeholder-page">
      <div className="placeholder-card">
        <Icon />
        <h3>{title}</h3>
        <p>{t('placeholder.underDev')}</p>
        <button className="btn btn-primary" disabled>
          {t('placeholder.comingSoon')}
        </button>
      </div>
    </div>
  )
}
