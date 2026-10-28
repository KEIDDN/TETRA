import { levelFor, useProfile } from '../lib/profile';

/** Profile level with a progress ring toward the next one. */
export function LevelChip() {
  const { xp } = useProfile();
  const { level, into, needed } = levelFor(xp);
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <span className="flex items-center gap-3" title={`${into} / ${needed} XP`}>
      <span className="relative grid size-9 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="#edebfa"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${(into / needed) * c} ${c}`}
            className="transition-[stroke-dasharray] duration-700 ease-spring"
          />
        </svg>
        <span className="tabular text-[12px] font-medium">{level}</span>
      </span>
      <span className="hidden flex-col sm:flex">
        <span className="label">Level {level}</span>
        <span className="tabular text-[11px] text-faint">
          {into} / {needed} XP
        </span>
      </span>
    </span>
  );
}
