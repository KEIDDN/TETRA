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
        if (st.stretch > 1.05) {
          ctx.save();
          ctx.translate(st.x, st.y);
          ctx.rotate(st.angle);
          const w = st.size * st.stretch;
          ctx.drawImage(sprite(st.color), -w / 2, -st.size / 2, w, st.size);
          ctx.restore();
        } else ctx.drawImage(sprite(st.color), st.x - st.size / 2, st.y - st.size / 2, st.size, st.size);
      }
      for (const wave of sim.waves) {
        const hex = `#${wave.color.toString(16).padStart(6, '0')}`;
        ctx.strokeStyle = hex;
        ctx.globalAlpha = 0.28 * wave.life;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.045 * wave.life;
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, Math.max(0, wave.radius - 14), 0, Math.PI * 2);
        ctx.stroke();
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
