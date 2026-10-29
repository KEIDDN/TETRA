import { useEffect, useState } from 'react';

const CELLS: [number, number][] = [
  [4, 12],
  [23.5, 12],
  [43, 12],
  [23.5, 31.5],
];

/** Once per session: the mark builds itself from minos, the word rises, and the menu appears. Any key or click skips it. */
export function LogoIntro() {
  const [shown, setShown] = useState(() => {
    try {
      return sessionStorage.getItem('tetra.intro') === null;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!shown) return;
    try {
      sessionStorage.setItem('tetra.intro', '1');
    } catch {
      // No session storage: it just plays again next time.
    }
    const done = () => setShown(false);
    const timer = setTimeout(done, 1650);
    window.addEventListener('keydown', done, { once: true });
    window.addEventListener('pointerdown', done, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', done);
      window.removeEventListener('pointerdown', done);
    };
  }, [shown]);
  if (!shown) return null;
  return (
    <div className="logo-intro fixed inset-0 z-50 grid place-items-center bg-black" aria-hidden>
      <div className="flex items-center gap-6">
        <svg width="84" height="84" viewBox="0 0 64 64" className="overflow-visible">
          {CELLS.map(([x, y], i) => (
            <rect
              key={i}
              className="logo-cell"
              style={{ animationDelay: `${i * 90}ms`, transformOrigin: `${x + 8.5}px ${y + 8.5}px` }}
              x={x}
              y={y}
              width="17"
              height="17"
              rx="4.5"
              fill="#fbfbfc"
            />
          ))}
        </svg>
        <span className="logo-word text-[64px] font-semibold tracking-[-0.03em]">TETRA</span>
      </div>
    </div>
  );
}
