/** The shop mark: a tyre with a puncture and a wrench across it. */
export function BrandMark({ className = 'size-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Govinda Tyre Puncture">
      <circle cx="24" cy="24" r="21" fill="#1d45f5" />
      <circle cx="24" cy="24" r="15.5" fill="none" stroke="#ffffff" strokeWidth="3" />
      <circle cx="24" cy="24" r="7.5" fill="none" stroke="#ffffff" strokeWidth="3" />
      <g stroke="#8eb6ff" strokeWidth="2.5" strokeLinecap="round">
        <path d="M24 8.5v3.5" />
        <path d="M24 36v3.5" />
        <path d="M8.5 24h3.5" />
        <path d="M36 24h3.5" />
      </g>
      <path
        d="M31.5 16.5l-9 9"
        stroke="#fbbf24"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="30.5" cy="17.5" r="3.5" fill="#fbbf24" />
    </svg>
  )
}

export function ShopHeader({
  shopName,
  subtitle,
  action,
}: {
  shopName: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className="size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink-950">{shopName}</p>
        {subtitle ? <p className="truncate text-xs text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}