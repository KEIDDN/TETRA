import { Application } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { music } from '../audio/music';
import { hexToNumber, SKINS } from '../game/skins';
import { ShaderScene, type SceneId } from '../game/scenes/shaderScene';

/**
 * A skin's scene as a full-screen backdrop for a page, breathing with
 * whatever music is playing. Switching `scene` crossfades to the next one.
 */
export function SceneBackdrop({ scene, cap = 0.2, className }: { scene: SceneId; cap?: number; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ set(id: SceneId): void } | null>(null);
  const initial = useRef(scene);

  useEffect(() => {
    let disposed = false;
    const app = new Application();
    let current: ShaderScene | null = null;
    let leaving: ShaderScene | null = null;
    let fade = 1;
    void app
      .init({ resizeTo: host.current!, background: '#000000', antialias: false, resolution: 1, preference: 'webgl' })
      .then(() => {
        if (disposed) return app.destroy(true);
        host.current!.appendChild(app.canvas);
        const make = (id: SceneId) => {
          const s = new ShaderScene(id, app.renderer, cap);
          const palette = SKINS[id].palette(1);
          for (const k of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const) s.palette[k] = hexToNumber(palette[k]);
          // No board here: park its rectangle off-screen so nothing is darkened.
          s.layout(app.screen.width, app.screen.height, 34, { x: -5000, y: -5000, w: 1, h: 1 });
          app.stage.addChild(s.view);
          return s;
        };
        current = make(initial.current);
        api.current = {
          set(id) {
            if (current?.id === id) return;
            leaving?.destroy();
            leaving = current;
            current = make(id);
            current.view.alpha = 0;
            fade = 0;
          },
        };
        const onResize = () => [current, leaving].forEach((s) => s?.layout(app.screen.width, app.screen.height, 34, { x: -5000, y: -5000, w: 1, h: 1 }));
        app.renderer.on('resize', onResize);
        let t = 0;
        app.ticker.add((tk) => {
          const dt = tk.deltaMS;
          t += dt;
          const bands = music.analyse();
          for (const s of [current, leaving]) {
            if (!s) continue;
            s.setAudio(bands);
            s.setEnergy(0.25 + bands.low * 0.35);
            s.update(dt);
          }
          // A slow ripple now and then so the scene feels alive even in silence.
          if (current && bands.beat > 0.95 && Math.random() < 0.25) current.ripple(Math.random() * app.screen.width, Math.random() * app.screen.height, 2 + bands.low * 3, 0xedebfa);
          if (fade < 1) {
            fade = Math.min(1, fade + dt / 900);
            if (current) current.view.alpha = fade;
            if (leaving) leaving.view.alpha = 1 - fade;
            if (fade === 1 && leaving) {
              leaving.destroy();
              leaving = null;
            }
          }
        });
      });
    return () => {
      disposed = true;
      api.current = null;
      current?.destroy();
      leaving?.destroy();
      try {
        app.destroy(true);
      } catch {
        // Not initialised yet.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => api.current?.set(scene), [scene]);

  return <div ref={host} className={className} aria-hidden />;
}
