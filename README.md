# Govinda Tyre Puncture

Billing, sales, staff, salary and alerts for a small tyre puncture shop, built
for the phone the counter actually sits on.

- **Owner** sees today's sales, every bill, reports, staff, salary payments and
  shop settings.
- **Employee** creates bills, prints receipts, sees their own bills and accepts
  the salary the owner recorded for them.
- Every row of data is protected by PostgreSQL row level security, so an
  employee cannot reach another person's bills, salary or messages even by
  editing a URL or calling the API directly.

## Contents

- [Stack](#stack)
- [Getting started](#getting-started)
- [Supabase setup](#supabase-setup)
- [Environment variables](#environment-variables)
- [Creating the first owner](#creating-the-first-owner)
- [Demo data](#demo-data)
- [Daily commands](#daily-commands)
- [Tests](#tests)
- [How the data is protected](#how-the-data-is-protected)
- [Deploying](#deploying)
- [Project layout](#project-layout)
- [Decisions worth knowing](#decisions-worth-knowing)

## Stack

| Part         | Choice                                                       |
| ------------ | ------------------------------------------------------------ |
| UI           | Next.js 16 (App Router, React 19, Server Actions), Tailwind 4 |
| Data         | Supabase (Postgres + Auth + Realtime)                         |
| Validation   | Zod on the server, plain React on the client                  |
| Money        | integer paise in the browser, `numeric` in Postgres           |
| Tests        | pgtap style SQL security tests, Playwright end to end tests   |

No runtime dependency is bundled into the browser except React and the
Supabase publishable key. The service role key is only ever imported by
`src/lib/supabase/admin.ts`, which is marked `server-only`.

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in the three keys
npm run dev                    # http://localhost:3000
```

The first person to open the app should visit `/setup` to create the owner
account and the shop. After that, `/setup` refuses to run again.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) and wait for it to
   finish provisioning.
2. Apply the migrations, in order:

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   Without the CLI, paste each file in `supabase/migrations/` into the SQL
   editor, in filename order. They are plain SQL and are safe to re-run.

3. In **Authentication → Providers**:
   - turn on **Email** (the shop owner signs in with email and password);
   - leave **Phone** off.

   Phone authentication is not used. Employees type their mobile number, and the
   server turns that number into the address Supabase Auth knows them by: a
   generated `employee-<uuid>@auth.govindatyrepuncture.internal` address created
   when the owner adds them. See
   [How employees sign in](#how-employees-sign-in) below. Nothing under Phone
   needs configuring, no SMS provider or OTP service is involved, and no Twilio
   or MessageBird account is ever needed.
4. In **Authentication → URL Configuration** set:
   - Site URL: the address people actually use, e.g. `https://tyre.example.com`
   - Redirect URLs: `http://localhost:3000/auth/callback` and
     `https://tyre.example.com/auth/callback`
5. In **Authentication → URL Configuration → Email → Template → Reset Password**
   keep the default `{{ .SiteURL }}/auth/callback?next=/update-password`.
6. **Project Settings → API** gives the three values for `.env.local`.

## Environment variables

| Name                              | Where it runs      | What it is                                    |
| --------------------------------- | ------------------ | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | browser + server   | Project URL                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser       | Publishable (anon) key; RLS is the only guard |
| `SUPABASE_SECRET_KEY`             | server only        | Admin operations: create logins, set/reset passwords |
| `NEXT_PUBLIC_SITE_URL`            | server             | Optional; used to build reset links            |

`SUPABASE_SECRET_KEY` is the current name for the elevated key. Projects created
before the rename still call it `SUPABASE_SERVICE_ROLE_KEY`, and the app accepts
either, preferring the new name when both are present.

The elevated key bypasses row level security. It is read only by server actions
that already checked that the caller is the owner, it is never sent to the
browser, and rotating it in the dashboard is safe.

## Creating the first owner

Either open `/setup` in the browser, or provision from the command line (handy
for a fresh project or for CI):

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... \
OWNER_EMAIL=owner@example.com OWNER_PASSWORD='a-strong-password' \
OWNER_NAME=Govinda SHOP_NAME='Govinda Tyre Puncture' \
npm run owner:create
```

`bootstrap_owner` is single use: it refuses to create a second shop, and
creating the login and the shop is one transaction as far as the caller is
concerned (if the shop fails, the login is deleted again).

## Demo data

For a throwaway project with two employees, a month of bills and a couple of
salary payments:

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
SUPABASE_SECRET_KEY=... OWNER_EMAIL=... OWNER_PASSWORD=... \
npm run demo:seed
```

Everything goes through the same RPCs the app uses, so the demo data obeys the
same rules (bill numbering, salary limits, notifications) instead of being
forced into the tables. `-- --reset` re-creates the demo employees.

## Daily commands

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Dev server                                          |
| `npm run build`     | Production build                                    |
| `npm run lint`      | ESLint                                              |
| `npm run typecheck` | `tsc --noEmit`                                      |
| `npm run db:test`   | Migrations + database security tests on scratch Postgres |
| `npm run test:e2e`  | Playwright tests against a real Supabase project     |
| `npm run owner:create` | Create the first owner and shop                 |
| `npm run demo:seed` | Fill a shop with demo data                           |

## Tests

### Database security tests

The most important tests in this project: they prove that Postgres itself
refuses the wrong reads and writes. They need a PostgreSQL server and nothing
else (no Docker, no Supabase CLI).

```bash
PGURL=postgresql://postgres@127.0.0.1:5432/postgres npm run db:test
```

The runner drops a scratch database, applies
`supabase/tests/harness/00_local_supabase_stub.sql` (a stand in for the Supabase
`auth` schema) and every migration, then runs `tests/rls/security.sql` as four
different database roles: the owner, two employees, and a logged out visitor.
Current state: **94 checks, 0 failures**, covering

- an employee cannot read, change or delete a colleague's bills, salary,
  employees or notifications;
- a disabled or half disabled account reads nothing and writes nothing, even
  with a still valid session;
- salaries cannot be overpaid, edited after the fact, accepted twice, or
  accepted on somebody else's behalf;
- bill totals are recalculated by the database, bill numbers are sequential per
  shop and per day, and bills cannot be created empty;
- the owner cannot be bootstrapped twice.

### End to end tests

Playwright drives the real app against a real Supabase project, because row
level security and Auth cannot be faked:

```bash
cp .env.test.local.example .env.test.local   # a throwaway project
npm run test:e2e
```

Use a project of its own: the tests deliberately try to break isolation, and
they create and disable accounts. They run on a phone viewport and a desktop
one, and cover signing in, the whole billing flow, the salary handshake, and
cross-employee access (screens, direct URLs and direct API calls).

## How the data is protected

- The browser only ever gets the publishable key. Every query runs as the
  signed-in user, so the policies decide what is visible.
- Writes go through `security definer` functions in the `private` schema with
  `set search_path = ''`. They derive the caller from `auth.uid()`, never from a
  parameter, so a crafted request cannot act as somebody else.
- Role and shop live in `public.profiles`; there is no role column anywhere a
  client can write.
- Both `employees.is_active` and `profiles.is_active` must be true before any
  data moves, so an account that is only half switched off reads nothing.
- Bills and salary payments are append only: no client may update or delete
  them, and the totals are computed by the database.
- Salary payments form a ledger: `pending` until the employee accepts, then
  `confirmed`; corrections are new cancelled rows, never edits.
- Money is stored as `numeric` and handled as integer paise in the browser, so
  a total cannot drift by a paisa between what the shop sees and what is stored.

## Deploying

Any Node host that runs Next.js works (Vercel, or a VPS with
`pm2`/`systemd`). For Vercel:

1. Import the repository and add the four environment variables.
2. Deploy.
3. Run `supabase db push` against the production project.
4. Open `/setup` once, from the real domain.

After deploying, add the production callback to the Supabase redirect URLs and
check that **Authentication → Emails → Leaked password protection** and rate
limits are on (they are by default).

## Project layout

```
supabase/migrations/   schema, RLS and RPCs, in order
supabase/tests/harness/ local stand in for the Supabase auth schema
tests/rls/             database security tests
tests/e2e/             Playwright tests
scripts/               create-owner.mjs, seed-demo.mjs, migrate-employee-auth.mjs
src/app/(auth)/        login, setup, password flows
src/app/employee/      employee screens
src/app/owner/         owner screens
src/components/        shared UI, billing wizard
src/lib/               supabase clients, auth guards, validation, money
src/proxy.ts           session refresh and route protection
```

## How employees sign in

An employee types their **mobile number** and a **password the owner sets**,
which they can change themselves from their own "Me" screen. That is the whole
form: no OTP, no SMS, and no code to read out over the phone.

Supabase Auth is the only thing that stores credentials, and it stores them
under an address the app generates:

- when the owner adds an employee, the server creates a login with a random
  `employee-<uuid>@auth.govindatyrepuncture.internal` address and the owner's
  password (confirmed, so nothing is ever emailed);
- at sign in, `signInEmployee` looks the number up through
  `public.employee_auth_user_id`, a `security definer` function that only
  `service_role` may call, reads that user's address from Supabase Auth, and
  signs in with the ordinary cookie based client.

`.internal` is reserved for private use, so the address can never collide with
a real inbox, and Supabase never sends mail to it. The address is not stored in
any table, is not shown in any screen, and never leaves the server: nothing in
the app, in the database or in a response depends on it, which is also why the
shop can never be locked out by an email delivery problem.

The number the owner can correct stays business data. Changing it on the staff
screen changes only the profile, and the employee signs in with the new number
straight away.

The cost of this is that the phone number is the login name, so it has to stay
with the person. An existing shop that already used phone authentication moves
over in place, keeping every user id, profile, bill and salary row:

```bash
SUPABASE_SECRET_KEY=… npm run auth:migrate-employees   # add --dry-run first
```

That script only adds an address to employee logins that have none. It never
deletes or recreates a user, never touches a password, and leaves owner logins
alone. If an employee has forgotten their password, the owner resets it from the
staff screen instead.

## Decisions worth knowing

- **No SMS.** Employees sign in with their mobile number and a password the
  owner sets, and can change it themselves. Supabase phone authentication is
  deliberately not enabled, so the shop keeps no SMS cost, needs no provider
  account, and never waits for a code to arrive. If an employee forgets their
  password, the owner resets it from their staff screen.
- **Service charge is its own line.** It is stored apart from the item list and
  sent as a separate service item, so it can never be added on top of a service
  total by mistake.
- **PWA, offline aware.** The app installs to the home screen and shows a
  helpful offline page, but it deliberately does *not* cache bills or receipts:
  the phone is shared, and a cached customer bill is a privacy problem.
- **Light only.** A shop counter is bright; the palette is tuned for that and
  touch targets are sized for gloves.
- **Realtime, not polling.** Bills, salary and alerts refresh through Supabase
  Realtime when something changes, so two phones stay in step.