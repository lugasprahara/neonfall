# neonfall

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/lugasprahara/neonfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/lugasprahara/neonfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

NEONFALL is an original arena-survival action game in vanilla JS: you are the last warden of a neon void, your weapons fire on their own, and your job is to move, survive, gather the light the fallen drop, and choose how you evolve — until the Hollow Star comes for you every 90 seconds.

## Run it

```sh
node serve.ts            # then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=aes5np1n&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

## The game

You are the last warden of a neon void. The swarm pours in from the dark;
your weapons fire on their own — your job is to move, survive, gather the
light the fallen drop, and choose how you evolve. Every 90 seconds the
Hollow Star, a vast geometric horror, comes to end you. Break it, and the
next one is angrier.

## How to play

- **Move:** WASD or the arrow keys. Weapons aim and fire automatically.
- **XP gems:** kills drop light. Collect it to level up, then pick 1 of 3
  upgrades (keys `1`–`3` or click): more damage, faster cycling, new
  weapons — Orbit Blades, the piercing Lance, the Nova Pulse — and stat
  boosts that stack.
- **Enemies:** magenta chasers, amber darts, hulking brutes, splitters
  that burst into darts, golden elites, and the Hollow Star boss with its
  radial bullet rings and telegraphed charges.
- **Pause:** `Esc` / `P`. **Mute:** `M`. **Restart after death:** `R` or click.
- Survive as long as you can; your best time and level are remembered.

The game is plain static files under `game/` — no build step, no network.
Serve it with the included development server (Node 22, standard library
only) as above, or with any static file server pointed at `game/`.

## Hand it in

`main.ts` is the entry program: it copies `game/` and `screenshots/` to
the output directory and writes `dossier.json` with the vendored make.fun
library (`vendor/makefun-game.ts`, the kit's copy, unchanged).

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — the page and its styling.
- `game/src/main.js` — state machine, spawn director, game loop.
- `game/src/entities.js` — player, enemies, projectiles, gems, particles.
- `game/src/weapons.js` — the four automatic weapons and the upgrade pool.
- `game/src/render.js` — canvas drawing: world, HUD, menus.
- `game/src/audio.js` — synthesized WebAudio effects and music.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — deterministic screenshot poses (`?shot=menu|action|levelup|boss&seed=N`).
- `game/src/config.js` — palette and balance tuning.
- `game/src/random.js` — seeded RNG (mulberry32).

Screenshots in `screenshots/` are real renders of the game, captured from
the poses named in `shots.json`.

## License

MIT — see `LICENSE`.
