import { AVATAR_KEYS, AVATAR_LABELS, initialsOf, isAvatarKey } from '@/lib/avatars'
import type { AvatarKey } from '@/lib/avatars'

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
} as const
export type AvatarSize = keyof typeof SIZES

const INITIALS_FONT: Record<AvatarSize, string> = {
  sm: '0.7rem',
  md: '0.85rem',
  lg: '1.25rem',
}

const VARIANTS: Record<AvatarKey, { tint: string; face: string; features: React.ReactNode }> = {
  cap: {
    tint: 'bg-sky-100',
    face: '#F3C29B',
    features: (
      <>
        <path d="M9 21c0-6.5 5-11.5 11-11.5s11 5 11 11.5z" fill="#111827" />
        <circle cx="20" cy="7.2" r="1.3" fill="#374151" />
        <path d="M6.5 20.5h27l-2.4 3.2a2.6 2.6 0 0 1-2 1h-18.2a2.6 2.6 0 0 1-2-1z" fill="#111827" />
      </>
    ),
  },
  curls: {
    tint: 'bg-amber-100',
    face: '#E8B183',
    features: (
      <>
        <circle cx="9.5" cy="13" r="3.2" fill="#6B4423" />
        <circle cx="13.5" cy="8.5" r="3.4" fill="#6B4423" />
        <circle cx="19" cy="7" r="3.4" fill="#6B4423" />
        <circle cx="24.5" cy="8.5" r="3.4" fill="#6B4423" />
        <circle cx="29" cy="12.5" r="3.2" fill="#6B4423" />
        <circle cx="6.5" cy="18" r="2.8" fill="#6B4423" />
        <circle cx="32.5" cy="17" r="2.8" fill="#6B4423" />
      </>
    ),
  },
  glasses: {
    tint: 'bg-violet-100',
    face: '#F3C29B',
    features: (
      <>
        <path d="M10 21a5 5 0 0 1 9 0" stroke="#1f2937" strokeWidth="1.5" fill="none" />
        <path d="M21 21a5 5 0 0 1 9 0" stroke="#1f2937" strokeWidth="1.5" fill="none" />
        <path d="M19 21h2" stroke="#1f2937" strokeWidth="1.5" />
        <path d="M9.5 21H5" stroke="#1f2937" strokeWidth="1.5" />
        <path d="M30.5 21H35" stroke="#1f2937" strokeWidth="1.5" />
      </>
    ),
  },
  moustache: {
    tint: 'bg-emerald-100',
    face: '#D99E6E',
    features: (
      <>
        <path d="M7 17a13 13 0 0 1 26 0 3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z" fill="#3F2A1A" />
        <path d="M15.5 27.5q4.5 3 9 0" stroke="#2b1b0f" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  headband: {
    tint: 'bg-rose-100',
    face: '#F3C29B',
    features: (
      <>
        <path d="M8 14a12 12 0 0 1 24 0z" fill="#6B4423" />
        <path d="M4.5 13.5q15.5-5 31 0" stroke="#e11d48" strokeWidth="4.2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  goggles: {
    tint: 'bg-teal-100',
    face: '#E8B183',
    features: (
      <>
        <rect x="9.5" y="14" width="9.5" height="8.5" rx="3" fill="rgba(14,116,144,0.12)" stroke="#0e7490" strokeWidth="1.6" />
        <rect x="21" y="14" width="9.5" height="8.5" rx="3" fill="rgba(14,116,144,0.12)" stroke="#0e7490" strokeWidth="1.6" />
        <path d="M19 18.2h2" stroke="#0e7490" strokeWidth="1.6" />
        <path d="M9.5 18.2H5" stroke="#0e7490" strokeWidth="1.6" />
        <path d="M30.5 18.2H35" stroke="#0e7490" strokeWidth="1.6" />
        <path d="M6 12.5c5-3 23-3 28 0" stroke="#0e7490" strokeWidth="1.4" fill="none" />
      </>
    ),
  },
}

export function Avatar({
  name,
  avatar,
  size = 'md',
  className = '',
}: {
  name: string | null | undefined
  avatar?: string | null
  size?: AvatarSize
  className?: string
}) {
  const label = (name ?? '').trim() || 'Employee'
  const key = avatar && isAvatarKey(avatar) ? avatar : null

  if (!key) {
    return (
      <span
        role="img"
        aria-label={`${label} avatar`}
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink-100 font-bold text-ink-700 ${SIZES[size]} ${className}`}
        style={{ fontSize: INITIALS_FONT[size] }}
      >
        {initialsOf(name)}
      </span>
    )
  }

  const variant = VARIANTS[key]

  return (
    <span
      role="img"
      aria-label={`${label} avatar`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${variant.tint} ${SIZES[size]} ${className}`}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true" className="h-full w-full">
        <circle cx="20" cy="21" r="15" fill={variant.face} />
        <circle cx="14.5" cy="20" r="1.7" fill="#1f2937" />
        <circle cx="25.5" cy="20" r="1.7" fill="#1f2937" />
        <path
          d="M15.5 26.5q4.5 3.2 9 0"
          stroke="#8b5a3c"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
        />
        {variant.features}
      </svg>
    </span>
  )
}

/** Radio-style picker used inside the owner's edit-employee form. */
export function AvatarPicker({ name, value }: { name: string; value: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-ink-950">Avatar</legend>
      <p className="text-xs text-ink-500">Pick the illustration that matches this staff member.</p>
      <div className="flex flex-wrap gap-2">
        <label className="w-[76px] cursor-pointer text-center">
          <input type="radio" name={name} value="" className="peer sr-only" defaultChecked={!value} />
          <span className="flex flex-col items-center gap-1 rounded-xl p-2 ring-1 ring-ink-200 transition peer-checked:bg-brand-50 peer-checked:ring-2 peer-checked:ring-brand-600">
            <Avatar name={value ? undefined : 'Initials'} avatar={value ? value : null} size="md" />
            <span className="text-[11px] font-medium text-ink-600">Initials</span>
          </span>
        </label>
        {AVATAR_KEYS.map((key) => (
          <label key={key} className="w-[76px] cursor-pointer text-center">
            <input type="radio" name={name} value={key} className="peer sr-only" defaultChecked={value === key} />
            <span className="flex flex-col items-center gap-1 rounded-xl p-2 ring-1 ring-ink-200 transition peer-checked:bg-brand-50 peer-checked:ring-2 peer-checked:ring-brand-600">
              <Avatar name={AVATAR_LABELS[key]} avatar={key} size="md" />
              <span className="text-[11px] font-medium text-ink-600">{AVATAR_LABELS[key]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}