import { useEffect, useRef, type ReactNode, type Ref } from 'react';

/** Radians between neighbouring rows on the drum. */
const STEP = 0.4;
/** Rows past this angle are hidden: they would be edge-on. */
const LIMIT = 1.3;

/**
 * A vertical wheel. The selected row sits in a glass lens at the centre;
 * the others wrap around a drum (compressing, dimming) and bend slightly
 * along an arc. Position follows the selection on a spring.
 */
export function ModeWheel<T extends string>({
  items,
  selected,
  label,
  extra,
  onSelect,
  onActivate,
  firstRef,
}: {
  items: T[];
  selected: T;
  label: (id: T) => string;
  extra?: (id: T) => ReactNode;
  onSelect: (id: T) => void;
  onActivate: (id: T) => void;
  firstRef?: Ref<HTMLButtonElement>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, items.indexOf(selected));
  const motion = useRef({ pos: index, vel: 0, target: index, lens: 0, frame: 0, last: 0 });
  const pressedSelected = useRef(false);

  useEffect(() => {
    const m = motion.current;
    m.target = index;
    const tick = (now: number) => {
      const dt = Math.min(0.05, m.last ? (now - m.last) / 1000 : 1 / 60);
      m.last = now;
      // Slightly underdamped: it lands with the faintest settle.
      const k = 190;
      const c = 2 * Math.sqrt(k) * 0.82;
      m.vel += ((m.target - m.pos) * k - m.vel * c) * dt;
      m.pos += m.vel * dt;
      layout();
      if (Math.abs(m.vel) < 0.0005 && Math.abs(m.target - m.pos) < 0.0005) {
        m.pos = m.target;
        layout();
        m.frame = 0;
        m.last = 0;
        return;
      }
      m.frame = requestAnimationFrame(tick);
    };
    const layout = () => {
      const first = rows.current[0];
      if (!first) return;
      const row = first.offsetHeight;
      const radius = (row * 1.02) / STEP;
      let lensWidth = 0;
      rows.current.forEach((el, i) => {
        if (!el) return;
        const d = i - m.pos;
        const a = d * STEP;
        const visible = Math.abs(a) < LIMIT;
        el.style.visibility = visible ? 'visible' : 'hidden';
        if (!visible) return;
        const cos = Math.cos(a);
        const near = Math.max(0, 1 - Math.abs(d));
        const x = -(1 - cos) * row * 0.35;
        const fade = Math.min(1, (LIMIT - Math.abs(a)) / 0.35);
        // A real drum: each row sits on a cylinder and turns with it, so the
        // letters foreshorten the way printed type on a wheel would, never squashed.
        el.style.transform = `translate3d(${x.toFixed(2)}px, 0, ${(-radius).toFixed(2)}px) rotateX(${(-a).toFixed(4)}rad) translateZ(${radius.toFixed(2)}px)`;
        el.style.opacity = String((0.16 + 0.84 * near * near) * fade);
        if (near > 0) lensWidth += (el.firstElementChild as HTMLElement).offsetWidth * near;
      });
      if (lens.current && lensWidth) lens.current.style.width = `${lensWidth + row * 0.7}px`;
    };
    layout();
    if (!m.frame) m.frame = requestAnimationFrame(tick);
    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [index]);

  useEffect(
    () => () => {
      cancelAnimationFrame(motion.current.frame);
      motion.current.frame = 0;
      motion.current.last = 0;
    },
    [],
  );

  // The mouse wheel turns the wheel, one row per notch.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let acc = 0;
    let lastStep = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += e.deltaY;
      const now = performance.now();
      if (Math.abs(acc) < 40 || now - lastStep < 70) return;
      const next = Math.min(items.length - 1, Math.max(0, motion.current.target + Math.sign(acc)));
      acc = 0;
      lastStep = now;
      rows.current[next]?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [items]);

  return (
    <div
      ref={box}
      className="relative pl-[0.45em] text-[clamp(30px,min(5.2vw,6.6vh),80px)] [transform-style:preserve-3d]"
      style={{ height: 'min(5.4em, 44vh)', perspective: '1100px', perspectiveOrigin: '25% 50%' }}
    >
      <div
        ref={lens}
        className="glass-lens pointer-events-none absolute top-1/2 left-0 h-[1.22em] -translate-y-1/2 rounded-[0.36em] transition-[width] duration-300 ease-out"
      />
      {items.map((id, i) => (
        <button
          key={id}
          ref={(el) => {
            rows.current[i] = el;
            if (i === 0 && firstRef) {
              if (typeof firstRef === 'function') firstRef(el);
              else (firstRef as { current: HTMLButtonElement | null }).current = el;
            }
          }}
          data-nav
          onFocus={() => onSelect(id)}
          onPointerDown={() => (pressedSelected.current = id === selected)}
          onClick={(e) => {
            // Keyboard and controller confirm at once; a click picks first, then plays.
            if (e.detail === 0 || pressedSelected.current) onActivate(id);
          }}
          className="absolute top-1/2 left-[0.45em] -mt-[0.55em] flex h-[1.1em] origin-left items-center gap-[0.3em] outline-none [backface-visibility:hidden] will-change-transform"
        >
          <span className="leading-none font-[480] tracking-[-0.045em] whitespace-nowrap">{label(id)}</span>
          {extra?.(id)}
        </button>
      ))}
    </div>
  );
}
