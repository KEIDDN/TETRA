import { useEffect, useRef } from 'react';
import { Lattice } from '../game/ambient';

const SPACING = 36;

/** Full-screen Canvas 2D rendering of the lattice, behind the home screen. */
export function AmbientBackground({ lattice }: { lattice: Lattice }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dirty = true;

    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      lattice.layout(window.innerWidth, window.innerHeight, SPACING, window.innerWidth / 2, window.innerHeight / 2);
      dirty = true;
    };
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      lattice.update(dt > 500 ? 16 : dt);
      // Static most of the time: only repaint while something moves.
      if (dirty || lattice.active || lattice.echoes.length) {
        dirty = false;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        lattice.forEachDot((dot) => {
          ctx.globalAlpha = dot.alpha;
          ctx.fillStyle = `#${dot.color.toString(16).padStart(6, '0')}`;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.lineWidth = 1.25;
        for (const echo of lattice.echoes) {
          ctx.save();
          ctx.translate(echo.x, echo.y);
          ctx.rotate(echo.rotation);
          ctx.scale(echo.scale, echo.scale);
          ctx.globalAlpha = lattice.echoAlpha(echo);
          ctx.strokeStyle = `#${echo.color.toString(16).padStart(6, '0')}`;
          ctx.beginPath();
          for (const [x0, y0, x1, y1] of Lattice.outline(echo.kind)) {
            ctx.moveTo(x0 * 26, y0 * 26);
            ctx.lineTo(x1 * 26, y1 * 26);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [lattice]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 h-full w-full" />;
}
