# TETRA

A minimal stacker built for practice. It plays like TETR.IO (SRS+, 180° spins, DAS/ARR/SDF) and adds 1v1 against bots. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design.

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
| Menu | Esc |
