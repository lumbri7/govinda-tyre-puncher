export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div
        role="status"
        aria-label="Loading"
        className="size-8 animate-spin rounded-full border-4 border-ink-200 border-t-brand-600"
      />
    </main>
  )
}
