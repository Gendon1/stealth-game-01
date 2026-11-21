# Shadow Archive — a stealth game for make.fun

[![bounty](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Gendon1/stealth-game-01/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Gendon1/stealth-game-01/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

**Shadow Archive** is a top-down stealth game for the [make.fun bounty](https://make.fun/bounty/best-stealth-game-20261121-1759): night in a museum archive, four glowing relics to recover, four guards on patrol, and one glowing EXIT to reach unseen.

## How to play

- **Move:** WASD or arrow keys. **Sneak:** hold Shift (slower, much harder to spot). **Click to move:** click anywhere to walk there, Shift-click to sneak there; any key press takes over from the click.
- **Goal:** collect all 4 relics, then reach the EXIT. The exit stays locked until every relic is recovered.
- **Guards:** each patrols a route with a visible vision cone, raycast against the walls — a crate or shelf really does cut a cone short, so what you see is what the guard can see. The eye meter in the HUD fills while a guard can see you (faster up close, slower at long range, slower still while sneaking); at 40% a guard gets suspicious and comes to look at the last place it saw you (marked with a gold diamond), at 100% it raises the alarm and chases. If it touches you, you lose a life and wake up back at the door. You have 3 lives.
- **Sound gives you away:** walking close past a guard lets it hear your footsteps even outside its cone — sneak when you are near one. A chasing guard close behind makes your heartbeat sound.
- **Pause:** P or Esc. **Mute:** M. **Start / retry:** Space or click.
- **Rating:** finish with no alarms for a GHOST rating, one alarm for SHADOW, more for LOUD. Your fastest clear is kept in this browser.

## How it is built

Plain static files under `game/` — vanilla JavaScript and canvas, no library, no network request, no build step. The source is split by job:

- `game/src/settings.js` — tuning numbers, palette, the level map and guard patrols
- `game/src/level.js` — the tile grid, movement collision and line-of-sight
- `game/src/guards.js` — patrol / suspicious / alert guard AI, sight and hearing
- `game/src/world.js` — the player, the detection meter, relics, lives and the win
- `game/src/render.js` — canvas drawing, raycast vision cones, HUD and panels
- `game/src/input.js` — keyboard and pointer input, including click-to-move
- `game/src/audio.js` — synthesised WebAudio footsteps, chimes, alarms and heartbeat
- `game/src/shots.js` — the deterministic screenshot scenes behind `?shot=`
- `game/src/main.js` — boot, the fixed-step loop and the five screens

All art is drawn with canvas shapes and gradients, and all sound is synthesised — nothing borrowed. Serve it with `node serve.ts` and open http://localhost:8080, or open `game/index.html` from any static server.

## Screenshots

1. `1-start.jpg` — the title over the live archive, guards on patrol.
2. `2-play.jpg` — sneaking with a relic recovered and a guard's cone closing in.
3. `3-alert.jpg` — spotted: the cone turns red and the guard chases.
4. `4-win.jpg` — all relics safe at the open exit.
