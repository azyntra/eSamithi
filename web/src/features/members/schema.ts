import { z } from 'zod'

// Validation mirrors the desktop: phone must be exactly 10 digits when given;
// everything else is optional free text (villages register members with
// partial paperwork). Uniqueness of society_id / NIC is checked server-side.
const optionalText = z.string().trim().max(255).optional().or(z.literal(''))

export const dependentSchema = z.object({
  name: z.string().trim().max(255).default(''),
  relationship: z.string().trim().max(100).default(''),
  date_of_birth: z.string().default(''),
  nic: z.string().trim().max(50).default(''),
  age: z.string().trim().regex(/^\d{0,3}$/, 'mform.age').default('')
})

export const memberSchema = z.object({
  society_id: z.string().trim().max(50).default(''),
  nic: z.string().trim().max(50).default(''),
  full_name: z.string().trim().max(255).default(''),
  date_of_birth: z.string().default(''),
  gender: z.enum(['Male', 'Female']).default('Male'),
  marital_status: z.enum(['Single', 'Married', 'Widowed']).default('Single'),
  occupation: optionalText.default(''),
  address: z.string().trim().max(2000).default(''),
  phone: z
    .string()
    .trim()
    .default('')
    .refine((v) => v === '' || /^\d{10}$/.test(v), 'mform.phoneInvalid'),
  date_of_joining: z.string().default(''),
  father_name: optionalText.default(''),
  mother_name: optionalText.default(''),
  father_in_law_name: optionalText.default(''),
  mother_in_law_name: optionalText.default(''),
  bank_name: z.string().default(''),
  bank_account_holder_name: optionalText.default(''),
  bank_account_number: z.string().trim().max(100).default(''),
  dependents: z.array(dependentSchema).default([])
})

export type MemberFormValues = z.input<typeof memberSchema>
export type MemberFormParsed = z.output<typeof memberSchema>

export const emptyMemberForm: MemberFormValues = {
  society_id: '',
  nic: '',
  full_name: '',
  date_of_birth: '',
  gender: 'Male',
  marital_status: 'Single',
  occupation: '',
  address: '',
  phone: '',
  date_of_joining: '',
  father_name: '',
  mother_name: '',
  father_in_law_name: '',
  mother_in_law_name: '',
  bank_name: '',
  bank_account_holder_name: '',
  bank_account_number: '',
  dependents: []
}

export const emptyDependent = { name: '', relationship: '', date_of_birth: '', nic: '', age: '' }
