#!/usr/bin/env node
/**
 * Fills an existing shop with demo data: two employees, a month of bills and a
 * couple of salary payments.
 *
 * Everything is created through the same RPCs the app uses, so the demo data
 * obeys the real rules (RLS, bill numbering, salary limits) instead of being
 * forced into the database.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
 *   SUPABASE_SECRET_KEY=... \
 *   OWNER_EMAIL=... OWNER_PASSWORD=... \
 *   node scripts/seed-demo.mjs
 *
 * Pass `--reset` to disable and re-create the demo employees first.
 * `SUPABASE_SERVICE_ROLE_KEY` is still accepted for older projects.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const ownerEmail = process.env.OWNER_EMAIL
const ownerPassword = process.env.OWNER_PASSWORD
const reset = process.argv.includes('--reset')

for (const [key, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
  SUPABASE_SECRET_KEY: serviceRoleKey,
  OWNER_EMAIL: ownerEmail,
  OWNER_PASSWORD: ownerPassword,
})) {
  if (!value) {
    console.error(`Missing environment variable ${key}`)
    process.exit(1)
  }
}

/**
 * Employee logins are internal addresses, never the phone number. Must match
 * src/lib/employee-identity.ts, which is what the app uses.
 */
const INTERNAL_IDENTITY_DOMAIN = 'auth.govindatyrepuncture.internal'
const newInternalEmployeeEmail = () => `employee-${crypto.randomUUID()}@${INTERNAL_IDENTITY_DOMAIN}`

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** A signed-in client, so every RPC runs as that user and hits the real RLS. */
async function signedInClient({ email, userId, password }) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  let address = email
  if (!address) {
    // Same lookup the login action does, on the server: employee -> Auth user.
    const { data: found, error: foundError } = await admin.auth.admin.getUserById(userId)
    if (foundError || !found.user?.email) {
      throw new Error(`Could not read the login identity: ${foundError?.message ?? 'no email'}`)
    }
    address = found.user.email
  }
  const { error } = await client.auth.signInWithPassword({ email: address, password })
  if (error) throw new Error(`Sign in failed: ${error.message}`)
  return client
}

const owner = await signedInClient({ email: ownerEmail, password: ownerPassword })

const { data: shop } = await owner.from('businesses').select('id, name').maybeSingle()
if (!shop) {
  console.error('No shop found. Run scripts/create-owner.mjs first.')
  process.exit(1)
}

const employees = [
  { name: 'Ravi Kumar', phone: '+919800000001', salary: 12000 },
  { name: 'Suresh Kumar', phone: '+919800000002', salary: 10000 },
]

/** Creates the demo employees (login + record) and returns signed-in clients. */
async function ensureEmployees() {
  const clients = []

  for (const person of employees) {
    const temporaryPassword = `seed-${person.phone.slice(-4)}`

    let { data: existing } = await admin
      .from('employees')
      .select('id, user_id')
      .eq('business_id', shop.id)
      .eq('user_id', (await owner.from('profiles').select('id').eq('phone', person.phone).maybeSingle()).data?.id ?? '')

    if (!existing) {
      const { data: created, error: userError } = await admin.auth.admin.createUser({
        email: newInternalEmployeeEmail(),
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: person.name },
      })
      if (userError) throw new Error(`Could not create ${person.name}: ${userError.message}`)

      if (reset) {
        await admin.auth.admin.deleteUser(created.user.id)
        continue
      }

      const { error: recordError } = await owner.rpc('create_employee_record', {
        p_user_id: created.user.id,
        p_full_name: person.name,
        p_phone: person.phone,
        p_monthly_salary: person.salary,
        p_joined_at: new Date().toISOString().slice(0, 10),
      })
      if (recordError) throw new Error(`Could not add ${person.name}: ${recordError.message}`)

      existing = { id: null, user_id: created.user.id }
    }

    clients.push({
      ...person,
      client: await signedInClient({ userId: existing.user_id, password: temporaryPassword }),
    })
  }

  return clients
}

const shoppers = [
  ['Harjit Singh', 'car', 'PB10AB1234'],
  ['Sunita Devi', 'bike', 'PB12CD4567'],
  ['Ramesh Kumar', 'bike', 'HR26EF7788'],
  ['Jaspal Singh', 'tractor', 'PB33GH9012'],
  ['Amarjit Kaur', 'car', 'DL08IJ3456'],
  ['Manpreet Singh', 'small_truck', 'PB45KL6789'],
  ['Gurpreet Kaur', 'scooter', 'PB10MN2345'],
  ['Baljinder Singh', 'car', 'PB99OP6789'],
]

const catalogue = {
  service: [
    ['Puncture Repair', '150'],
    ['Tube Replacement', '250'],
    ['Wheel Balancing', '300'],
    ['Tyre Patching', '200'],
  ],
  part: [
    ['Tube', '450'],
    ['Valve Rubber', '80'],
    ['Patch Kit', '50'],
  ],
  custom: [['Wheel Alignment', '500'], ['Oil Top-up', '120']],
}

function pick(list, index) {
  return list[index % list.length]
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function isoDay(daysAgo) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

async function seedBills(client, days, count, label) {
  let created = 0

  for (let index = 0; index < count; index += 1) {
    const day = Math.max(0, days - randomBetween(0, days - 1))
    const customer = pick(shoppers, randomBetween(0, shoppers.length - 1))
    const items = []

    for (const [type, entries] of Object.entries(catalogue)) {
      if (Math.random() < 0.45) continue
      const [name, unitPrice] = pick(entries, randomBetween(0, entries.length - 1))
      items.push({
        item_type: type,
        name,
        quantity: '1',
        unit_price: unitPrice,
      })
    }

    if (items.length === 0) continue

    const { error } = await client.rpc('create_bill', {
      p_customer_name: customer[0],
      p_vehicle_type: customer[1],
      p_vehicle_number: customer[2],
      p_items: items,
      p_customer_phone: null,
    })

    if (error) {
      console.warn(`  skipped a bill for ${label} on ${isoDay(day)}: ${error.message}`)
      continue
    }
    created += 1
  }

  return created
}

console.log(`Seeding demo data for ${shop.name}...`)

const staff = await ensureEmployees()
console.log(`Employees ready: ${staff.map((person) => person.name).join(', ')}`)

const ownerBills = await seedBills(owner, 30, 14, 'owner')
console.log(`Created ${ownerBills} demo bills for the owner`)

let employeeBills = 0
for (const person of staff) {
  const created = await seedBills(person.client, 30, 18, person.name)
  employeeBills += created
  console.log(`Created ${created} demo bills for ${person.name}`)
}

for (const person of staff) {
  const { data: employees } = await owner
    .from('employees')
    .select('id, monthly_salary')
    .eq('business_id', shop.id)
    .eq('is_active', true)
  const record = employees?.find((employee) => employee.monthly_salary === person.salary)
  if (!record) continue

  const { error } = await owner.rpc('record_salary_payment', {
    p_employee_id: record.id,
    p_amount: Math.round(person.salary * 0.5),
    p_payment_date: isoDay(randomBetween(3, 20)),
    p_note: 'Advance',
  })
  if (error) console.warn(`  no salary payment for ${person.name}: ${error.message}`)
}

console.log(`\nDone. ${ownerBills + employeeBills} demo bills created.`)
console.log('Demo employee logins use the mobile numbers +91 9800000001 / +91 9800000002')
console.log('with the passwords seed-0001 / seed-0002 (reset them from the owner screen).')