import { useEffect, useRef } from 'react';
import { music } from '../../audio/music';
import type { ExperienceScene, Formation } from './ExperienceScene';

/** The Experience's 3D blocks as a backdrop, moving with whatever music plays. Three.js loads with it. */
export function Stage3D({ formation, className = '' }: { formation: Formation; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ExperienceScene | null>(null);

  useEffect(() => {
    let disposed = false;
    void import('./ExperienceScene').then(({ ExperienceScene }) => {
      if (disposed || !host.current) return;
      const next = new ExperienceScene(host.current);
      next.centered = true;
      next.stagger = 4;
      next.formation = formation;
      scene.current = next;
    });
    let raf = 0;
    const tick = () => {
      if (scene.current) scene.current.bands = music.analyse();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      scene.current?.dispose();
      scene.current = null;
    };
    // The formation is set once; later changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scene.current) scene.current.formation = formation;
  }, [formation]);

  return <div ref={host} aria-hidden className={className} />;
}
