export const REPORT_TABS = ['monthly', 'annual', 'arrears', 'app'] as const
export const ARREARS_TABS = ['overdue', 'fds', 'members'] as const
export const APP_USAGE_FILTERS = ['all', 'online', 'active', 'occasional', 'dormant', 'not_enrolled', 'blocked'] as const
export type ReportTab = (typeof REPORT_TABS)[number]
export type ArrearsTab = (typeof ARREARS_TABS)[number]
export type AppUsageFilter = (typeof APP_USAGE_FILTERS)[number]
