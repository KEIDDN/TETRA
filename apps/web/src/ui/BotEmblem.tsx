import type { BotProfile } from '@tetra/bot';
import { useMemo } from 'react';

/** Deterministic glyph for a bot: a symmetric cluster of minos that grows with its level. */
function glyph(bot: BotProfile): [number, number][] {
  let seed = [...bot.id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const rand = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) % 10000) / 10000;
  // Grow a connected shape on the left half (columns 0–2 of a 5×5 grid), then mirror it.
  const half = new Set<string>(['2,2']);
  const target = 2 + Math.ceil(bot.level * 0.6);
  let guard = 0;
  while (half.size < target && guard++ < 200) {
    const cells = [...half].map((k) => k.split(',').map(Number));
    const [x, y] = cells[Math.floor(rand() * cells.length)];
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)];
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx > 2 || ny < 0 || ny > 4) continue;
    half.add(`${nx},${ny}`);
  }
  const out = new Set<string>();
  for (const k of half) {
    const [x, y] = k.split(',').map(Number);
    out.add(`${x},${y}`);
    out.add(`${4 - x},${y}`);
  }
  return [...out].map((k) => k.split(',').map(Number) as [number, number]);
}

export function BotEmblem({ bot, size = 48, glow = false, locked = false }: { bot: BotProfile; size?: number; glow?: boolean; locked?: boolean }) {
  const cells = useMemo(() => glyph(bot), [bot]);
  const color = locked ? '#3a3a3f' : bot.color;
  const pad = 9;
  const step = (100 - pad * 2) / 5;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      className="shrink-0 transition-[filter] duration-300"
      style={{ filter: glow && !locked ? `drop-shadow(0 0 ${size / 6}px ${color}88)` : undefined }}
    >
      <defs>
        <linearGradient id={`emblem-bg-${bot.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.22} />
          <stop offset="1" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="98" height="98" rx="26" fill={`url(#emblem-bg-${bot.id})`} stroke={color} strokeOpacity={0.35} strokeWidth="1.5" />
      {cells.map(([x, y]) => (
        <rect key={`${x},${y}`} x={pad + x * step + 1.2} y={pad + y * step + 1.2} width={step - 2.4} height={step - 2.4} rx={step * 0.24} fill={color} fillOpacity={locked ? 0.5 : 0.92} />
      ))}
    </svg>
  );
}
