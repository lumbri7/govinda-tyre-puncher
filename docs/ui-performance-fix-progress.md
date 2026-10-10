# UI / performance fix — progress notes

Safe, non-secret log of work done while fixing the deployed Govinda Tyre
Puncher site. No credentials, customer data or private values belong here.

## Phase 1 — money formatting and responsive stat cards (done)

Findings:
- Currency display already routes through `formatRupees()` in
  `src/lib/money.ts`. It uses `Intl.NumberFormat('en-IN')` and already omits
  ".00" for whole rupees (`abs % 100 === 0 ? 0 : 2` minimum fraction digits)
  while always showing both paise digits for fractional amounts. Grouping is
  Indian (`₹1,23,45,678.90`). No silent rounding in calculations: money is
  held as integer paise end to end.
- The only non-"₹" money renderer, `formatPaise()` at
  `src/app/owner/reports/page.tsx:141`, feeds the CSV download where a plain
  numeric (`24000.00`) is the correct, spreadsheet-friendly shape. Left as is.
- Salary edit hint rendered "Currently 24000.00"; switched to
  `formatRupees(...)` → "Currently ₹24,000" (display only; the input default
  value still uses the numeric shape).
- No `overflow-x: hidden` workarounds or fixed widths were found around the
  cards; nothing to remove. The only `overflow-x-auto` blocks are intentional
  (`ScrollTable` and the date-range filter).

Changes:
- `src/components/ui.tsx` — `Stat` value now uses fluid typography
  `clamp(1.125rem, 5vw, 1.5rem)` (back to `text-2xl` on `sm+`), plus
  `[overflow-wrap:anywhere]` so a full-lakh amount can never escape its card
  or drive document-wide horizontal scrolling at 320–412px. The card keeps its
  `min-width: 0`, `p-4`, ring/shadow style and the label/value/hint hierarchy.
- `src/app/owner/employees/[id]/edit-employee-form.tsx` — hint now shows
  `formatRupees(...)`.

Tests (new, lightweight, no new dependency):
- `tests/unit/playwright.config.ts` and `tests/unit/money.spec.ts` run through
  Playwright's TypeScript transform in plain Node (no browsers, no server, no
  database). Covers: `₹24,000`, `₹12,000`, `₹58,145` (no decimals), fractional
  `.50`, lakh grouping, sign handling, and parse/calculation exactness.
- Script added: `npm run test:unit` → 4 passed (2.7s).

Responsive viewport verification (320/360/375/390/412px) is a focused, browser
check that still needs the app server; it is scheduled in Phase 5 so it is not
yet "executed and passed".

## Phase 2 — employee avatars (done)

Findings:
- Neither `profiles` nor `employees` had an avatar field, and there was no
  upload/storage path. Added a minimal, deliberate schema change instead of
  inventing client-side state.
- Only the owner may edit other people's profiles
  (`profiles_update_self_or_owner`, `profiles_insert_owner_only` in
  `supabase/migrations/20260101000200_rls.sql`). An employee can update their
  own profile only, so requirement 8 stays satisfied by the existing policies.
- The employee update RPC `update_employee_record(...)` has no avatar
  parameter. Rather than change its signature, the avatar is written with a
  separate owner-scoped `profiles.update` after the RPC succeeds.

Changes:
- `supabase/migrations/20260101001000_employee_avatars.sql` — adds
  `profiles.avatar text` with a check constraint over the bundled key set.
  Not applied automatically; it is documented for manual production apply in
  Phase 6.
- `src/lib/avatars.ts` — bundled, license-safe key list + labels, `initialsOf`,
  and `readProfiles` / `updateProfileAvatar` helpers. The helpers detect a
  missing `avatar` column (`/avatar/i` on the PostgREST error) and degrade to
  initial-only reads / a no-op write, so the app code is safe to deploy before
  the manual migration is applied — no 400s, no broken owner edit flow.
- `src/components/avatar.tsx` — `Avatar` (illustrated SVG set for the six keys,
  initials fallback, sizes sm/md/lg, `role="img"` + label) and `AvatarPicker`
  (radio fieldset used in the owner edit form).
- `src/app/owner/employees/[id]/edit-employee-form.tsx` — accepts
  `avatar`/`avatarAvailable`; shows the picker only once the column exists.
- `src/app/owner/actions.ts` — `updateEmployee` validates the submitted key
  (`isAvatarKey`) and persists it via `updateProfileAvatar` after the RPC.
- `src/lib/database.types.ts` — `profiles.avatar: string | null` on
  Row/Insert/Update.
- Displayed consistently in: Staff list and Staff detail/header (owner),
  Salary overview + waiting + recent rows (owner), Dashboard latest bills and
  the Bills list (owner), and the employee's own "My salary" header.

Tests:
- `tests/unit/avatar.spec.ts` — labels cover all keys, `isAvatarKey` accepts
  only bundled keys, `initialsOf` never returns empty, and the migration's
  check constraint lists exactly the bundled keys.
- Unit config broadened to `testMatch: /\.spec\.ts$/`.
- `npm run test:unit` → 8 passed; `npm run typecheck` and `npm run lint` clean.

## Phase 3 — diagnose and fix the 8–10 s delays (in progress)

Findings:
- Deployed: function region `iad1` (US East), edge `bom1` (Mumbai); Supabase RTT warm ~150–350ms, cold ~1s for JWKS (ES256) — region/distance is a likely contributor, not the sole bulk delay.
- Structural issue: multiple sequential auth/DB round trips on protected navigations (proxy `getClaims()` + profiles role lookup; `getSession` via `getClaims` + profiles + businesses + employee sequentially; layout blocks on notifications unread count). `loading.js` only at root, and Next 16 notes `loading.js` does not show fallback for layouts that access runtime data, making navigation appear frozen.
- Realtime debounced, SW fetch has no artificial timeout — not delay sources.

Changes:
- `src/lib/perf.ts` — opt-in timing (only `PERF_LOG=1`); logs only fixed labels, route kinds, durations; no tokens, cookies, user ids, customer/financial data.
- `src/lib/auth.ts` — `getSession` parallelizes `businesses` and employee lookups; adds granular timings.
- `src/lib/supabase/proxy.ts` — added route-kind timing and timing for signed-out branch.
- Deferred blocking notifications: `src/components/notifications-unread.tsx` (server) wrapped in `<Suspense>` in `src/app/owner/layout.tsx` and `src/app/employee/layout.tsx`; `src/components/notification-bell.tsx` accepts optional `children` to render suspense-resolved count (preserves behavior).
- Added route-level `loading.tsx` for key segments under `src/app/owner/` and `src/app/employee/` (bills, employees, salary, reports, alerts, me, bill/new, dynamic [id]) plus top-level/area roots, consistent with `src/app/loading.tsx`. These are perceived-performance improvements, not root-cause fixes.

Status:
- Typecheck: clean (0 errors)
- Unit tests: 8/8 passed (`npm run test:unit`)
- Lint: clean for touched files (loading + perf + auth + proxy + notification components)

Unresolved:
- Proxy does a `profiles` role lookup on every matched request (including non-/ AUTH_ROUTES navigations) to resolve role and session invalidation. Changing this requires careful redirect logic; defer unless measurements show it is the hot path.
- Vercel function region `iad1` vs edge `bom1` (deployment-level) — noted for Phase 6 (nearest region). This is likely the largest distance cost for India users and cannot be fixed by code alone.
- No authenticated before/after timings collected in this session (no safe write-capable test account sign-in performed). Per-route measurements (especially `owner/dashboard`, `owner/reports`, `employee/salary`) remain to be done in an environment where `PERF_LOG=1` can be observed without logging sensitive data.

Next: quantify actual server timings for slow routes under `PERF_LOG=1` (if available) and only optimize based on evidence. Do not start Phase 4/5.

## Phase 4 — Supabase and security checks (not started)

## Phase 5 — verification (not started)

## Phase 6 — final report and deployment (not started)

## Phase 4 — Pre-production verification (website)

Results:
- TypeScript: clean (0 errors)
- Unit tests: 8/8 passed (`tests/unit/playwright.config.ts`)
- Build (with placeholder env vars for validation): succeeded (Next.js 16.3.8). All routes compiled; no type/lint errors surfaced during build.

Notes:
- Used dummy Supabase env values for build-only validation; real values required only for runtime/auth.
- Performed no production data writes, no migrations, no E2E full runs.

## Preview release task (website only)

Status:
- Branch: vercel-preview-prep (current)
- Remotes: origin https://github.com/lumbri7/govinda-tyre-puncher.git (push blocked: no Git credentials/gh CLI)
- TypeScript: clean (0 errors)
- Unit tests: 8/8 passed
- Lint: clean (no errors/warnings)
- Build (placeholder env): succeeded; all routes compiled

Git:
- Modified: 16 tracked files (Phase 1–3 work + minor edits)
- Untracked: new loading.tsx files, avatar components/lib, perf helper, avatar migration, unit test configs/specs

Deployment:
- Preview deployment to Vercel not attempted (push blocked). No production deployment triggered.
- No migrations applied, no production data modified, no secrets exposed.

Blockers:
- Git credentials missing (no gh CLI) — cannot push branch to origin for Vercel Preview
- Production URL not confirmed for Android release (separate task, not done)
