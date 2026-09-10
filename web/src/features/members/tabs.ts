export const MEMBER_TABS = ['overview', 'statement', 'dependents', 'app'] as const
export type MemberTab = (typeof MEMBER_TABS)[number]
