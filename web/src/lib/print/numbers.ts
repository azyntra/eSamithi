// Receipt numbering is derived from record ids and must stay byte-identical
// to the desktop so numbers continue unchanged (requirements FR-12.1).
const pad5 = (id: number): string => String(id).padStart(5, '0')

export const incomeReceiptNo = (id: number): string => `INC-${pad5(id)}`
export const expenseVoucherNo = (id: number, voucherNo?: string | null): string => voucherNo || `EXP-${pad5(id)}`
export const loanPaymentReceiptNo = (id: number): string => `LNP-${pad5(id)}`
export const loanStatementNo = (id: number): string => `LN-${pad5(id)}`
