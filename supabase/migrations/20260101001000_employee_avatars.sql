-- ---------------------------------------------------------------------------
-- Employee avatars
--
-- A small set of bundled, license-safe illustrated avatars that the shop
-- owner can pin to each employee. The key is stored on `profiles` (the
-- identity row), so every screen that names an employee renders the same
-- avatar. NULL means the initials fallback is shown.
--
-- Applied to the production database manually and deliberately: the app code
-- degrades cleanly until this column exists, so the deploy order is safe
-- either way.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column avatar text
  check (avatar is null or avatar in ('cap', 'curls', 'glasses', 'moustache', 'headband', 'goggles'));

comment on column public.profiles.avatar is
  'Key of the illustrated avatar the owner picked, from the bundled set.';