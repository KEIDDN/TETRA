# TETRA

A minimal stacker built for practice. It plays like TETR.IO (SRS+, 180° spins, DAS/ARR/SDF) and adds 1v1 against bots.

Modes: 40 Lines, Blitz, Marathon, Endless. Six skins (Default, Liquid Glass, Mono, Outline, Neon, Paper), effects with Off/Subtle/Full intensity, and synthesized sound with five packs — all in Settings. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design.

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # engine tests
pnpm typecheck
pnpm build
```

## Layout

- `packages/engine`: deterministic game engine in pure TypeScript (no DOM)
- `apps/web`: Vite + React + Tailwind menus, PixiJS board renderer

## Controls

| Action | Key |
|---|---|
| Move | ← → |
| Soft drop | ↓ |
| Hard drop | Space |
| Rotate CW / CCW / 180 | X or ↑ / Z / A |
| Hold | C or Shift |
| Retry | R |
| Pause | Esc |

Everything is rebindable in Settings, where handling (DAS, ARR, SDF, DCD) is set separately for keyboard and controller. Controllers work out of the box: d-pad to move, d-pad up to hard drop, A/B/Y to rotate, bumpers to hold, Start to pause, Select to retry.
