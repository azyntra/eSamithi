export const REPORT_TABS = ['monthly', 'annual', 'arrears'] as const
export const ARREARS_TABS = ['overdue', 'fds', 'members'] as const
export type ReportTab = (typeof REPORT_TABS)[number]
export type ArrearsTab = (typeof ARREARS_TABS)[number]
