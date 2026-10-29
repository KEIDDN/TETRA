/** The T mark and the wordmark. */
export function Logo({ large = false, className = '' }: { large?: boolean; className?: string }) {
  const mark = large ? 34 : 22;
  return (
    <span className={`flex items-center ${large ? 'gap-3.5' : 'gap-2.5'} ${className}`}>
      <svg width={mark} height={mark} viewBox="0 0 64 64" aria-hidden>
        <g fill="#fbfbfc">
          <rect x="4" y="12" width="17" height="17" rx="4.5" />
          <rect x="23.5" y="12" width="17" height="17" rx="4.5" />
          <rect x="43" y="12" width="17" height="17" rx="4.5" />
          <rect x="23.5" y="31.5" width="17" height="17" rx="4.5" />
        </g>
      </svg>
      <span className={large ? 'text-[28px] font-semibold tracking-[-0.03em]' : 'text-[15px] font-semibold tracking-[-0.01em]'}>TETRA</span>
    </span>
  );
}
