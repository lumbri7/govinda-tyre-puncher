/**
 * Internal identity for employee logins.
 *
 * Supabase Auth identifies a login by email or by phone. The shop does not want
 * SMS, and an employee's real phone number is business data that the owner must
 * be able to correct, so neither is a good Auth identity. Instead every
 * employee login gets an address in this reserved, non-routable domain:
 *
 *     employee-<random uuid>@auth.govindatyrepuncture.internal
 *
 * `.internal` is reserved by RFC 8375 for private use, so these addresses can
 * never collide with, or be delivered to, a real mailbox. They are an
 * implementation detail: the employee only ever types their mobile number, and
 * the address never leaves the server.
 *
 * No 'server-only' marker on purpose, so the owner creation action, the
 * migration script and the end to end tests all build addresses the same way.
 */
export const INTERNAL_IDENTITY_DOMAIN = 'auth.govindatyrepuncture.internal'

/**
 * A fresh internal identity.
 *
 * crypto.randomUUID() is a CSPRNG, so two employees can never be handed the
 * same address. The `employee-` prefix keeps the address recognisable in the
 * Supabase dashboard without telling anyone anything about the shop.
 */
export function newInternalEmployeeEmail(): string {
  return `employee-${crypto.randomUUID()}@${INTERNAL_IDENTITY_DOMAIN}`
}

/** True when an address is one of ours, i.e. an employee login, not an owner. */
export function isInternalEmployeeEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.endsWith(`@${INTERNAL_IDENTITY_DOMAIN}`)
}