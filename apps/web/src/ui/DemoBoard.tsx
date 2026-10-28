import { Game } from '@tetra/engine';
import { useEffect, useRef } from 'react';
import { AutoPlayer } from '../game/autoplay';
import { computeDemoLayout } from '../game/layout';
import { GameRenderer } from '../game/renderer';
import { SKINS } from '../game/skins';
import { getSettings } from '../lib/settings';

/** A game that plays itself in the player's current skin: the home screen's hero. */
export function DemoBoard({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    let renderer: GameRenderer | null = null;
    let observer: ResizeObserver | null = null;
    const { appearance } = getSettings();

    GameRenderer.create(host, { transparent: true }).then((r) => {
      if (disposed) return r.destroy();
      renderer = r;
      r.setOptions({ skin: SKINS[appearance.skin], fx: appearance.fx === 'off' ? 'off' : 'subtle', smoothFall: true, ghost: false, grid: appearance.grid });
      const relayout = () => r.setLayout(computeDemoLayout(host.clientWidth, host.clientHeight));
      relayout();
      observer = new ResizeObserver(relayout);
      observer.observe(host);

      let game: Game;
      let player: AutoPlayer;
      let start = 0;
      let endedAt = 0;
      const reset = (now: number) => {
        game = new Game({ seed: (Math.random() * 2 ** 32) >>> 0, rules: { gravity: 0.02 } });
        player = new AutoPlayer(game);
        start = now;
        endedAt = 0;
        r.reset();
      };
      reset(performance.now());

      // Background tabs freeze rAF; skip the gap instead of simulating it.
      let last = performance.now();
      r.ticker.add(() => {
        const now = performance.now();
        if (now - last > 500) start += now - last;
        last = now;
        const t = now - start;
        player.update(t);
        game.update(t);
        for (const e of game.events) r.onEvent(e, game, now);
        game.events.length = 0;
        if (game.state !== 'playing') {
          if (!endedAt) {
            endedAt = now;
            r.endGame('topout', now);
          } else if (now - endedAt > 1600) reset(now);
        }
        r.draw(game, now);
      });
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      renderer?.destroy();
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden />;
}
