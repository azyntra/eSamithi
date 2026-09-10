import { z } from 'zod'

// Router search params round-trip through JSON: a link written as "?create=1"
// parses back as the number 1, while a hand-typed or bookmarked URL may carry
// the string. Both mean the same thing, so accept either and let pages read
// the flag as a boolean.
export const flagSchema = z.union([z.literal(1), z.literal('1'), z.literal(true)]).optional().catch(undefined)
export type Flag = z.infer<typeof flagSchema>
export const FLAG_ON = 1 as const
