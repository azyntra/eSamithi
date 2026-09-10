export const WALLET_TABS = ['liquid', 'investments', 'assets'] as const
export type WalletTab = (typeof WALLET_TABS)[number]
