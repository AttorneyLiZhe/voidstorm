# VOIDSTORM

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/gentle-otter-96/voidstorm/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/gentle-otter-96/voidstorm/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**VOIDSTORM** is an original neon arena survival shooter for the desktop browser. One pilot
ship holds a 1280×720 arena against escalating waves of five kinds of hostile — Drifters,
Weavers, Spitters, Splitters and the capital-class Hollow Star that arrives every fifth
wave. Downed hostiles drop salvage; flying over it levels the ship up and offers a choice of
three systems (split cannons, lance rounds, an Aegis shield, repair nanobots and more), so
every run builds a different ship. It is complete: title screen, HUD, waves with banners, a
boss health bar, pause, a game-over screen with full run stats, and instant restart.

Everything is hand-rolled: vector art drawn in code, synthesized WebAudio sound and music,
a fixed-step simulation with a seeded random source — no engine, no libraries, no assets,
no network. The whole game is the static files under `game/`.

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

Or serve the `game/` folder with any static file server and open `index.html`.
Controls: **WASD / arrows** to fly, **mouse** to aim, **hold click or Space** to fire,
**1 · 2 · 3 or click** to choose an upgrade, **P** pause, **M** mute, **R** restart.

## Layout

- `game/` — the game itself: `index.html` plus ES modules under `game/src/`
  (`world.js` the simulation, `render.js` the canvas art and HUD, `audio.js` the synth,
  `input.js`, `config.js`, `random.js`, and `shots.js`, the deterministic screenshot scenes)
- `screenshots/` — real renders of the game in a browser, captured from the `?shot=` scenes
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes
  the judge's `dossier.json` with the vendored library in `vendor/` (the make.fun kit's copy)
- `serve.ts` — a tiny local server for development

MIT licensed — see `LICENSE`.

---
<sub>Entered on [make.fun](https://make.fun/?ref=1z6f5rn5&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
