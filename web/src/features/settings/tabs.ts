export const SETTINGS_TABS = ['general', 'loans', 'income', 'expense', 'users', 'security', 'about'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]
