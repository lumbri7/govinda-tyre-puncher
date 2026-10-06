import { z } from 'zod'

import { parseAmountToPaise, parseQuantityToCenti, paiseToNumericString } from '@/lib/money'

/**
 * Shared input validation.
 *
 * The database validates and recalculates everything again, so these schemas
 * exist to give the shop a fast, specific error message instead of a generic
 * one, and to reject obviously wrong input before a round trip.
 */

export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d]/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0+(?=\d{10}$)/, '')
  return digits.length === 10 ? `+91${digits}` : ''
}

export function normalizeVehicleNumber(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'That password is too long.')
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
    message: 'Use at least one letter and one number.',
  })

const fullName = z
  .string()
  .trim()
  .min(2, 'Please enter the full name.')
  .max(60, 'That name is too long.')

export const ownerSignupSchema = z.object({
  fullName,
  businessName: z.string().trim().min(2, 'Enter the shop name.').max(80, 'That shop name is too long.'),
  email: z.email('Enter a valid email address.').transform(normalizeEmail),
  password,
})

export const ownerLoginSchema = z.object({
  email: z.email('Enter a valid email address.').transform(normalizeEmail),
  password: z.string().min(1, 'Enter your password.'),
})

export const employeeLoginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'Enter your mobile number.')
    .transform(normalizePhone)
    .refine((value) => value.length > 0, 'Enter a 10 digit mobile number.'),
  password: z.string().min(1, 'Enter your password.'),
})

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address.').transform(normalizeEmail),
})

/**
 * Password plus confirmation. Used by the owner when they set an employee's
 * first password and when they reset it later, and by anyone changing their own
 * password, so the rule is identical everywhere.
 */
export const updatePasswordSchema = z.object({
  password,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Both passwords must match.',
  path: ['confirmPassword'],
})

export const employeeFormSchema = z.object({
  fullName,
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((value) => value.length > 0, 'Enter a 10 digit mobile number.'),
  monthlySalary: z
    .string()
    .trim()
    .min(1, 'Enter the monthly salary.')
    .refine((value) => (parseAmountToPaise(value) ?? -1) >= 0, 'Enter a valid amount.')
    .refine((value) => (parseAmountToPaise(value) ?? 0) <= 10_000_000_00, 'That amount is too large.'),
  joinedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid joining date.')
    .refine((value) => value <= new Date().toISOString().slice(0, 10), 'The joining date cannot be in the future.'),
})

export const salaryPaymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Enter the amount.')
    .refine((value) => (parseAmountToPaise(value) ?? 0) > 0, 'Enter an amount greater than zero.')
    .refine((value) => (parseAmountToPaise(value) ?? 0) <= 10_000_000_00, 'That amount is too large.'),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')
    .refine((value) => value <= new Date().toISOString().slice(0, 10), 'The payment date cannot be in the future.'),
  note: z.string().trim().max(200, 'Keep the note under 200 characters.').optional(),
})

const billItemSchema = z.object({
  itemType: z.enum(['service', 'part', 'custom']),
  name: z.string().trim().min(1, 'Enter the item name.').max(60, 'That name is too long.'),
  quantityCenti: z.number().int().positive().max(999_900, 'That quantity is too large.'),
  unitPricePaise: z.number().int().min(0).max(100_000_000_00, 'That price is too large.'),
})

export const billSchema = z.object({
  customerName: z.string().trim().min(1, 'Enter the customer name.').max(80, 'That name is too long.'),
  customerPhone: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : normalizePhone(value)))
    .refine((value) => value === null || value.length > 0, 'Enter a 10 digit mobile number.'),
  vehicleType: z.enum(['bike', 'car', 'small_truck', 'large_truck', 'tractor', 'other']),
  vehicleNumber: z
    .string()
    .trim()
    .transform(normalizeVehicleNumber)
    .refine((value) => value.length >= 4, 'Enter the vehicle number.').refine(
      (value) => value.length <= 15,
      'That vehicle number is too long.',
    ),
  vehicleDescription: z
    .string()
    .trim()
    .max(80, 'That vehicle description is too long.')
    .default(''),
  items: z
    .array(billItemSchema)
    .min(1, 'Add at least one item to the bill.')
    .max(50, 'A bill can have at most 50 items.'),
}).superRefine((value, ctx) => {
  // Anything the shop does not recognise still has to be described, so the
  // receipt says what was worked on. The database enforces the same rule.
  if (value.vehicleType === 'other' && value.vehicleDescription.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['vehicleDescription'], message: 'Describe the vehicle.' })
  }
})

export type OwnerSignupInput = z.infer<typeof ownerSignupSchema>
export type EmployeeFormInput = z.infer<typeof employeeFormSchema>
export type SalaryPaymentInput = z.infer<typeof salaryPaymentSchema>
export type BillInput = z.infer<typeof billSchema>
export type BillItemInput = z.infer<typeof billItemSchema>

/** Shape the bill items take inside the `create_bill` jsonb payload. */
export function toRpcItems(items: BillItemInput[]) {
  return items.map((item) => ({
    item_type: item.itemType,
    name: item.name,
    quantity: paiseToNumericString(item.quantityCenti),
    unit_price: paiseToNumericString(item.unitPricePaise),
  }))
}

export function toSalaryNumber(amount: string): number {
  return Number(paiseToNumericString(parseAmountToPaise(amount) ?? 0))
}

export function toSalaryQuantity(input: string): number {
  return Number(paiseToNumericString(parseQuantityToCenti(input) ?? 0))
}

/** Flatten a zod error into `{ field: first message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    result[key] ??= issue.message
  }
  return result
}