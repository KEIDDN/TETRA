/** The level in a ring that fills with XP. */
export function LevelRing({ level, progress, size = 176 }: { level: number; progress: number; size?: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 176 176" className="absolute inset-0 -rotate-90">
        <circle cx="88" cy="88" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle
          cx="88"
          cy="88"
          r={r}
          fill="none"
          stroke="#edebfa"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${progress * c} ${c}`}
          className="transition-[stroke-dasharray] duration-1000 ease-spring"
          style={{ filter: 'drop-shadow(0 0 10px rgba(237,235,250,0.45))' }}
        />
      </svg>
      <span className="tabular leading-none font-medium tracking-[-0.04em]" style={{ fontSize: size * 0.32 }}>{level}</span>
    </div>
  );
}
