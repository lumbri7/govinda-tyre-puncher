/** Line icons for the navigation, sized for a phone. */
const base = 'size-6'

export function IconBill({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" />
      <path d="M9.5 8h5M9.5 12h5" strokeLinecap="round" />
    </svg>
  )
}

export function IconHome({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconChart({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
    </svg>
  )
}

export function IconStaff({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" strokeLinecap="round" />
      <path d="M16 6.2a3 3 0 010 5.6M17.5 19.5c-.2-1.9-.9-3.2-2-4.1" strokeLinecap="round" />
    </svg>
  )
}

export function IconRupee({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M7 5h10M7 9.5h10M15.5 5c0 3-2.2 4.5-5 4.5H7l8 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconBell({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M6.5 10a5.5 5.5 0 1111 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10z" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 004 0" strokeLinecap="round" />
    </svg>
  )
}

export function IconUser({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.4-5.5 7-5.5s6.2 1.9 7 5.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconPlus({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

export function IconBack({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M14.5 5.5L8 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSettings({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 3.5v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.4-5.9l-1.4 1.4M7.9 16.1l-1.4 1.4m12.4 0l-1.4-1.4M7.9 7.9L6.5 6.5"
        strokeLinecap="round"
      />
    </svg>
  )
}