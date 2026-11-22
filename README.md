# heist-keen-stork-20

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/bongekanjing/heist-keen-stork-20/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/bongekanjing/heist-keen-stork-20/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

The Quiet Hour: a top-down stealth heist in one room. You are a thief crossing the Meridian
Building's third floor at a quiet hour, after the Halcyon diamond. Four guards sweep vision cones
across the reading hall and the vault room, a camera watches the case, and the alarm meter climbs
while any cone holds you and falls back when you break line of sight in shadow or behind cover.

WASD or the arrow keys to move, Shift to sprint (fast, loud), Ctrl to crouch (slow, quiet), E to
use a door or the power terminal that kills the camera, and a mouse click to throw a coin that
lands where you click and pulls the nearest guard to it. Take the diamond to start the getaway, then
leave by the dock exit. Four routes run through the floor: the front way across the cones, the
service corridor, the roof vent crawl, and the vault side door.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

The game itself is `game/` — static files, ES modules, no network and no build step, so
`game/index.html` also opens straight from disk. `node main.ts` stages `game/` and `screenshots/`
into `$MAKEFUN_OUTPUT_DIR` (default `/output`) and writes `dossier.json` for the judge.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
