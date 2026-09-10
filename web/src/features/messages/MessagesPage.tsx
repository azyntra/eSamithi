import { Inbox, Megaphone, Store } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useT } from '@/lib/i18n'
import { AnnouncementsTab } from './components/AnnouncementsTab'
import { PurukaTab } from './components/PurukaTab'
import { RequestsTab } from './components/RequestsTab'

export type MessagesTab = 'announcements' | 'requests' | 'puruka'

export function MessagesPage({
  tab,
  pendingOnly,
  create = false,
  onTabChange,
  onFilterChange,
  onCreateHandled
}: {
  tab: MessagesTab
  pendingOnly: boolean
  create?: boolean
  onTabChange: (t: MessagesTab) => void
  onFilterChange: (pending: boolean) => void
  onCreateHandled?: () => void
}) {
  const { t } = useT()

  return (
    <>
      <PageHeader title={t('nav.messages')} description={t('msg.subtitle')} />

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as MessagesTab)}>
        <TabsList>
          <TabsTrigger value="announcements">
            <Megaphone /> {t('msg.tabAnnouncements')}
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Inbox /> {t('msg.tabRequests')}
          </TabsTrigger>
          <TabsTrigger value="puruka">
            <Store /> {t('msg.tabPuruka')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="announcements">
          <AnnouncementsTab create={create} onCreateHandled={onCreateHandled} />
        </TabsContent>
        <TabsContent value="requests">
          <RequestsTab pendingOnly={pendingOnly} onFilterChange={onFilterChange} />
        </TabsContent>
        <TabsContent value="puruka">
          <PurukaTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
