/** A run history as a line with its area; the best run (or the one in `mark`) gets a dot. */
export function Sparkline({ values, lowerIsBetter, mark, height = 90 }: { values: number[]; lowerIsBetter: boolean; mark?: number; height?: number }) {
  const w = 480;
  const h = height;
  if (values.length < 2)
    return (
      <div style={{ height: h }} className="mt-5 grid place-items-center rounded-[18px] bg-white/[0.02] text-[13px] text-faint">
        Play a few runs to see your curve.
      </div>
    );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const t = (v - min) / span;
    return [(i / (values.length - 1)) * w, 8 + (lowerIsBetter ? t : 1 - t) * (h - 16)] as const;
  });
  const bestIndex = mark ?? values.indexOf(lowerIsBetter ? min : max);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-5 w-full overflow-visible" style={{ height: h }}>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#edebfa" stopOpacity="0.22" />
          <stop offset="1" stopColor="#edebfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#spark)" />
      <polyline points={line} fill="none" stroke="#edebfa" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={pts[bestIndex][0]} cy={pts[bestIndex][1]} r="4" fill="#edebfa" />
    </svg>
  );
}
