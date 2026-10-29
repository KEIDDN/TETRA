import { BLITZ, ENDLESS, Game, MARATHON, type GameStats, type ModeId, type Rules } from '@tetra/engine';
import { useEffect, useRef } from 'react';
import type { BotProfile } from '@tetra/bot';
import { AutoPlayer } from '../game/autoplay';
import { botHandling, BotPilot, solo } from '../game/pilot';
import { computeDemoLayout } from '../game/layout';
import { GameRenderer } from '../game/renderer';
import { resolveGrid, SKINS, type SkinId } from '../game/skins';
import { getSettings, subscribeSettings } from '../lib/settings';

export type DemoMode = ModeId | 'versus';

/** How the showcase plays each mode: its rules (never ending) and the autoplayer's pace. */
const DEMO: Record<DemoMode, { rules: Partial<Rules>; think: number; tap: number }> = {
  sprint: { rules: { gravity: 0.02 }, think: 170, tap: 55 },
  blitz: { rules: { ...BLITZ.rules, timeLimit: null }, think: 90, tap: 40 },
  marathon: { rules: MARATHON.rules, think: 240, tap: 75 },
  endless: { rules: ENDLESS.rules, think: 200, tap: 60 },
  versus: { rules: { gravity: 0.02 }, think: 260, tap: 80 },
};

interface Props {
  mode: DemoMode;
  skin: SkinId;
  /** Plays as this bot instead: its own brain, pace and mistakes, exactly as in a match. */
  bot?: BotProfile;
  className?: string;
  /** A line clear happened; `y` is 0–1 down the board. */
  onClear?: (power: number, y: number) => void;
  onStats?: (stats: GameStats) => void;
  /** Settings preview: every visual setting applies live, room included. */
  live?: boolean;
  /**
   * Shows the skin's room behind the board: always ('on'), or only while the
   * Experience is on ('experience'), so flipping to Focus turns the light off live.
   */
  room?: 'on' | 'experience';
}

/** A game that plays itself in the player's skin: the home screen's hero. */
export function DemoBoard({ mode, skin, bot, className, onClear, onStats, live = false, room }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controls = useRef<{ setMode(mode: DemoMode): void; setSkin(skin: SkinId): void; restart(): void } | null>(null);
  const callbacks = useRef({ onClear, onStats });
  callbacks.current = { onClear, onStats };
  const initial = useRef({ mode, skin, live, room });
  const botRef = useRef(bot);
  botRef.current = bot;

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    let renderer: GameRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let cleanup = () => {};

    GameRenderer.create(host, { transparent: true }).then((r) => {
      if (disposed) return r.destroy();
      renderer = r;
      const applySkin = (id: SkinId) => {
        const { appearance } = getSettings();
        const s = SKINS[id];
        if (initial.current.room) {
          const on = initial.current.room === 'on' || getSettings().experience;
          r.setOptions({
            skin: s,
            fx: on ? 'full' : 'subtle',
            smoothFall: true,
            ghost: false,
            grid: resolveGrid(appearance.grid, s),
            ambient: on,
            background: 'full',
            reduceFlashing: appearance.reduceFlashing,
            sceneQuality: appearance.sceneQuality,
          });
        } else if (initial.current.live) {
          r.setOptions({
            skin: s,
            fx: appearance.fx,
            smoothFall: appearance.smoothFall,
            ghost: appearance.ghost,
            grid: resolveGrid(appearance.grid, s),
            ambient: appearance.ambient && appearance.fx !== 'off',
            background: appearance.background,
            reduceFlashing: appearance.reduceFlashing,
            sceneQuality: appearance.sceneQuality,
          });
        } else {
          r.setOptions({ skin: s, fx: appearance.fx === 'off' ? 'off' : 'subtle', smoothFall: true, ghost: false, grid: resolveGrid(appearance.grid, s), ambient: false });
        }
      };
      applySkin(initial.current.skin);
      const unsubscribe = initial.current.live
        ? subscribeSettings(() => applySkin(getSettings().appearance.skin))
        : initial.current.room === 'experience'
          ? subscribeSettings(() => applySkin(initial.current.skin))
          : () => {};
      const relayout = () => r.setLayout(computeDemoLayout(host.clientWidth, host.clientHeight));
      relayout();
      observer = new ResizeObserver(relayout);
      observer.observe(host);

      let current = initial.current.mode;
      let game!: Game;
      let player!: { update(t: number): void; dispose?(): void };
      let start = 0;
      let endedAt = 0;
      let disposePlayer = () => {};
      let statsAt = 0;
      const reset = (now: number) => {
        const demo = DEMO[current];
        const b = botRef.current;
        player?.dispose?.();
        game = new Game({ seed: (Math.random() * 2 ** 32) >>> 0, rules: demo.rules, handling: b ? botHandling(b) : undefined });
        player = b ? new BotPilot(b, solo(game), 0) : new AutoPlayer(game, { think: demo.think, tap: demo.tap });
        disposePlayer = () => player?.dispose?.();
        start = now;
        endedAt = 0;
        r.reset();
      };
      reset(performance.now());
      cleanup = () => {
        disposePlayer();
        unsubscribe();
      };
      controls.current = {
        restart: () => reset(performance.now()),
        setMode(next) {
          if (next === current) return;
          current = next;
          reset(performance.now());
        },
        setSkin: applySkin,
      };

      // Background tabs freeze rAF; skip the gap instead of simulating it.
      let last = performance.now();
      r.ticker.add(() => {
        const now = performance.now();
        if (now - last > 500) start += now - last;
        last = now;
        const t = now - start;
        game.update(t);
        player.update(t);
        game.update(t);
        for (const e of game.events) {
          r.onEvent(e, game, now);
          if (e.type === 'clear' && e.info.lines > 0) {
            const power = e.info.lines + (e.info.spin === 'full' ? 2 : 0) + (e.info.perfectClear ? 4 : 0);
            callbacks.current.onClear?.(power, 1 - (e.rows[0]?.y ?? 0) / 20);
          }
        }
        game.events.length = 0;
        if (game.state !== 'playing') {
          if (!endedAt) {
            endedAt = now;
            r.endGame('topout', now);
          } else if (now - endedAt > 1600) reset(now);
        }
        if (now - statsAt > 200) {
          statsAt = now;
          callbacks.current.onStats?.(game.stats);
        }
        r.draw(game, now);
      });
    });

    return () => {
      disposed = true;
      cleanup();
      controls.current = null;
      observer?.disconnect();
      renderer?.destroy();
    };
  }, []);

  useEffect(() => controls.current?.setMode(mode), [mode]);
  useEffect(() => controls.current?.restart(), [bot]);
  useEffect(() => {
    initial.current.skin = skin;
    controls.current?.setSkin(skin);
  }, [skin]);

  return <div ref={hostRef} className={className} aria-hidden />;
}
