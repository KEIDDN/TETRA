import { useEffect, useRef } from 'react';

/**
 * A large liquid-glass switch between two options. The knob travels on a
 * spring and stretches with its speed, like a drop of glass, then settles.
 */
export function GlassSwitch({ options, value, onChange }: { options: [string, string]; value: 0 | 1; onChange: (v: 0 | 1) => void }) {
  const knob = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const motion = useRef({ x: value, v: 0, frame: 0, last: 0 });

  useEffect(() => {
    const m = motion.current;
    const step = (now: number) => {
      const dt = Math.min(0.033, m.last ? (now - m.last) / 1000 : 1 / 60);
      m.last = now;
      const k = 260;
      const c = 2 * Math.sqrt(k) * 0.72;
      m.v += ((value - m.x) * k - m.v * c) * dt;
      m.x += m.v * dt;
      const el = knob.current;
      const width = track.current?.clientWidth ?? 0;
      if (el) {
        const speed = Math.min(1, Math.abs(m.v) / 6);
        // Stretched along the motion, squeezed across it: the drop leans into where it is going.
        el.style.transform = `translateX(${m.x * (width / 2 - 6)}px) scale(${1 + speed * 0.22}, ${1 - speed * 0.12})`;
        el.style.transformOrigin = m.v >= 0 ? 'left center' : 'right center';
      }
      if (Math.abs(m.v) < 0.001 && Math.abs(value - m.x) < 0.001) {
        m.x = value;
        m.frame = 0;
        m.last = 0;
        return;
      }
      m.frame = requestAnimationFrame(step);
    };
    cancelAnimationFrame(m.frame);
    m.last = 0;
    m.frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(m.frame);
  }, [value]);

  return (
    <div
      ref={track}
      role="switch"
      aria-checked={value === 1}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onChange(value === 0 ? 1 : 0);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onChange(value === 0 ? 1 : 0);
        }
      }}
      className="glass-panel relative grid h-[76px] w-[min(420px,80vw)] cursor-pointer grid-cols-2 items-center rounded-full p-1.5 outline-none select-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <div ref={knob} className="glass-light absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] rounded-full will-change-transform" />
      {options.map((name, i) => (
        <span
          key={name}
          className={`relative z-10 text-center text-[19px] font-[560] tracking-[-0.02em] transition-colors duration-500 ${value === i ? 'text-black' : 'text-white/55'}`}
        >
          {name}
        </span>
      ))}
    </div>
  );
}
