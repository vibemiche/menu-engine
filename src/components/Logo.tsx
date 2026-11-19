export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-serif text-lg font-semibold tracking-tight ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="8" fill="#2f6b4f" />
        <path d="M10 22V10l6 7 6-7v12" fill="none" stroke="#fbf8f3" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Menu Engine
    </span>
  );
}
