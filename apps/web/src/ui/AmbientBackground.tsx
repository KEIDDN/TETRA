import { useEffect, useRef } from 'react';
import type { AmbientSim } from '../game/ambient';

/** Full-screen Canvas 2D rendering of an ambient field, behind the home screen. */
export function AmbientBackground({ sim }: { sim: AmbientSim }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // One soft white dot, tinted per color once and reused.
    const sprites = new Map<number, HTMLCanvasElement>();
    const sprite = (color: number) => {
      let c = sprites.get(color);
      if (!c) {
        c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d')!;
        const hex = `#${color.toString(16).padStart(6, '0')}`;
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, hex);
        grad.addColorStop(0.25, `${hex}cc`);
        grad.addColorStop(1, `${hex}00`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        sprites.set(color, c);
      }
      return c;
    };

    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      sim.resize(window.innerWidth, window.innerHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      sim.update(dt > 500 ? 16 : dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      for (const m of sim.motes) {
        const st = sim.style(m);
        ctx.globalAlpha = st.alpha;
        ctx.drawImage(sprite(st.color), st.x - st.size / 2, st.y - st.size / 2, st.size, st.size);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [sim]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 h-full w-full" />;
}
