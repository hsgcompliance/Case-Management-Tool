# Secret Games — Reference Guide

Hidden mini-games embedded throughout the app. Disabled by default; enabled per-org via admin config stored in `orgConfig.secretGames`.

---

## Quick Enable (minimum viable)

Set `orgConfig.secretGames` to:
```json
{
  "flags": {
    "masterEnabled": true,
    "legacyAdaptersEnabled": true,
    "customerPageEnabled": true,
    "ambientTriggersEnabled": true
  },
  "routesEnabled": ["customers", "grants", "home"],
  "games": {
    "legacy-runner": { "enabled": true, "allowedRoutes": ["customers"] },
    "legacy-snake":  { "enabled": true, "allowedRoutes": ["customers"] },
    "legacy-space-invaders": { "enabled": true, "allowedRoutes": ["customers"] },
    "legacy-tower-defense":  { "enabled": true, "allowedRoutes": ["customers"] }
  },
  "triggers": {
    "bug":      { "enabled": true, "allowedRoutes": ["customers"], "minIntervalMinutes": 10, "jitterMinutes": 2 },
    "asteroid": { "enabled": true, "allowedRoutes": ["customers"], "minIntervalMinutes": 14, "jitterMinutes": 5 },
    "plant":    { "enabled": true, "allowedRoutes": ["customers"], "minIntervalMinutes": 12, "jitterMinutes": 4 },
    "snake":    { "enabled": true, "allowedRoutes": ["customers"], "minIntervalMinutes": 13, "jitterMinutes": 4 }
  }
}
```

---

## Admin Flags (`flags`)

| Flag | Default | Effect |
|------|---------|--------|
| `masterEnabled` | `false` | **Master switch.** Must be `true` for anything to work. `killSwitch: true` overrides this. |
| `sandboxEnabled` | `false` | Enables sandbox-control triggers (dev-only launch buttons in `/dev` page). |
| `legacyAdaptersEnabled` | `false` | Enables the 5 legacy-adapter games (runner, snake, space invaders, tower defense, bug game). |
| `customerPageEnabled` | `false` | Enables in-card native games on the Customers page. |
| `ambientTriggersEnabled` | `false` | Enables the 4 ambient floating triggers (bug, asteroid, plant, snake). |
| `killSwitch` | `false` | **Emergency off.** Overrides `masterEnabled`. Set this to instantly disable all games org-wide. |

---

## Container Modes

Games mount into one of five containers, from smallest to largest:

| Mode | Where | Notes |
|------|-------|-------|
| `inline` | Inside the card, no expansion | Tiny games only (flip, ~260×180 min) |
| `card-expanded` | Card panel expands to fit | Most card-native games (farm, broken-data) |
| `card-focus` | Card zoomed/focused view | Focus mode for card-native games |
| `modal` | Full-screen dialog | Most mini-player games (runner, snake, 1945, tower defense) |
| `overlay` | Fixed overlay covering the full app | Immersive games (bug game, necromancer, asteroids) |

The container resolver picks `preferredContainerMode` if space allows; otherwise promotes up to the next mode. Set `allowsOverlayFallback: true` in the play profile to allow automatic promotion to overlay.

---

## Trigger Types

| Kind | How it fires | Example |
|------|-------------|---------|
| `search-exact` | User types the exact command in the global search bar | Type `farm` → farm game opens |
| `konami` | User types ↑↑↓↓←→←→BA on keyboard | Launches necromancer mode |
| `hidden-ui` | A hidden/ambient UI element is clicked | The bug floater click → DK/bug game |
| `sandbox-control` | Dev-only button in `/dev` page | Available when `sandboxEnabled: true` |
| `legacy-launcher` | Via QuickBreakModal or ArcadeFolder legacy paths | Runner/snake/etc from the existing launcher |

---

## Ambient Triggers

Four creatures float across the screen periodically on the Customers page. Requires `ambientTriggersEnabled: true`.

| Trigger | Emoji | Launches | Default timing |
|---------|-------|---------|---------------|
| `bug` | 🪲 | Bug Game (DK-style canvas) | every 10–12 min |
| `asteroid` | ☄️ | Space Invaders (1945) | every 14–19 min |
| `plant` | 🌱 | Tower Defense | every 12–16 min |
| `snake` | 🐍 | Snake | every 13–17 min |

**Timing**: each trigger fires after `minIntervalMinutes + random(0, jitterMinutes)` since the last appearance. Configurable per trigger in admin config.

**Components**: `GameTriggersHost.tsx` renders all four. Each is a separate floating animation component in `games/triggers/`.

---

## All 10 Games

### 1. Runner (legacy-runner)
- **Kind**: legacy-adapter → mini-player host
- **Launch**: QuickBreakModal, ArcadeFolder, or `/dev` sandbox
- **Container**: modal (preferred) or overlay
- **Gameplay**: Endless dino runner. Jump to avoid cacti, dash obstacles, and sharks. Double-jump supported. Obstacles scale in difficulty with score. Speed lines and particle effects add juice.
- **Scoring**: +1 per obstacle cleared. Near-miss = spark burst. Bonus floating star items for extra points. High score persisted to `userExtras.gameHighScores.runner`.
- **Difficulty curve**: `1 - exp(-score/38)` — takes ~50 points to reach 75% max difficulty. Speed ramps from 5.3 px/frame upward as score climbs.
- **Easter eggs**: Theme randomizes at score milestones. Hidden konami-style color override via `easterEggArmed`.
- **Feature flag**: `secretGamesGameLegacyRunnerEnabled`

### 2. Snake (legacy-snake)
- **Kind**: legacy-adapter → mini-player host
- **Launch**: ArcadeFolder, ambient snake floater, or `/dev` sandbox
- **Container**: modal (preferred) or overlay
- **Gameplay**: Classic snake on an 18×12 grid. Board auto-expands toward window size every 14 seconds. Controls: arrow keys or WASD. Pause with Space.
- **Scoring**: +1 per apple eaten. High score persisted to `userExtras.gameHighScores.snake`.
- **Difficulty**: Snake speeds up as score grows (interval 95ms → ~62ms min). Board expansion creates more room but also more area to navigate.
- **Feature flag**: `secretGamesGameLegacySnakeEnabled`

### 3. 1945 / Space Invaders (legacy-space-invaders)
- **Kind**: legacy-adapter → mini-player host
- **Launch**: ArcadeFolder, ambient asteroid floater, or `/dev` sandbox
- **Container**: modal (preferred) or overlay
- **Gameplay**: Canvas-based space shooter. Move with arrow keys or mouse; hold Space to fire. Survive waves of small/medium/large enemies, then boss waves every 10 waves.
- **Wave scaling**: HP = `baseHp × (1 + wave × 0.13 + exponential_term)`. Enemy count caps at 28. Spawn interval shrinks from 110 frames to ~18 frames.
- **Triple shot**: Auto-unlocks at wave 5 — fires three bullets per shot.
- **Lives**: Starts with 3. Earns +1 life every 5 waves (max 6).
- **Scoring**: Score × wave multiplier per kill. Boss = 300 × wave points.
- **Enemy types**: small (fast, 1 HP), medium (3 HP), large (6 HP), boss (40 HP, spawns every 10 waves, then shoots aimed bullets).
- **Feature flag**: `secretGamesGameLegacySpaceInvadersEnabled`

### 4. Tower Defense (legacy-tower-defense)
- **Kind**: legacy-adapter → mini-player host
- **Launch**: ArcadeFolder, ambient plant floater, or `/dev` sandbox
- **Container**: modal (preferred) or overlay
- **Gameplay**: SVG-based tower defense on a 900×520 canvas. Two map themes: Tron (dark) and Grass (light). Place towers by selecting a type and clicking on the map. Manage budget.
- **Tower types**:
  - **Pulse** (75g): Rapid single-target, 9 dmg, 122 range. Good all-rounder.
  - **Cannon** (140g): Slow burst, 26 dmg, splash 42px. Best vs. clusters.
  - **Frost** (130g): Slows enemies 36%, 5 dmg. Essential for boss waves.
  - **Laser** (280g): Continuous beam, 18 dmg/tick, piercing. Unlocks at **round 30**.
- **Upgrades**: Each tower has Power / Range / Speed tracks (max level 3 each). Fully-upgraded towers get +20% to all stats.
- **Enemy types**: runner, balloon, brute, phase (30% dodge), boss (splits into balloons), miniboss (splits into bosses), megaboss (appears round 20+, splits into minibosses).
- **Lives**: Starts at 10. Enemies reaching the exit cost 1–8 lives depending on type. Earns +1 life on boss wave clears (every 10 rounds, max 15).
- **Economy**: Starts with 300g. Wave-clear bonus = `10^1.1 × round^0.9`. Build cost scales +35% per 10 rounds.
- **Feature flag**: `secretGamesGameLegacyTowerDefenseEnabled`

### 5. Bug Game (legacy-bug-game)
- **Kind**: legacy-adapter → fullscreen overlay canvas
- **Launch**: Ambient bug floater click
- **Container**: overlay only (960×640 min)
- **Gameplay**: DK-style canvas game. Full-screen overlay. The adapter host work is planned but not yet landed — registered in registry now for future migration.
- **Feature flag**: `secretGamesGameLegacyBugGameEnabled`

### 6. Flip (flip)
- **Kind**: native, card-native
- **Launch**: Type `flip` in global search, or `/dev` sandbox
- **Container**: inline (preferred), card-expanded, card-focus
- **Gameplay**: Micro card-flip interaction inside the customer card. Reversible in ~3–10 seconds.
- **Persistence scope**: user + customer (state is scoped to a specific customer)
- **Feature flag**: `secretGamesGameFlipEnabled`

### 7. Broken Data (broken-data)
- **Kind**: native, card-native
- **Launch**: Type `broken data` in global search, or `/dev` sandbox
- **Container**: card-expanded (preferred), card-focus
- **Gameplay**: Anomaly event — the customer card shows a "corrupted snapshot" that the user repairs. First native anomaly-style game.
- **Persistence scope**: user + customer
- **Feature flag**: `secretGamesGameBrokenDataEnabled`

### 8. Farm (farm)
- **Kind**: native, card-native
- **Launch**: Type `farm` in global search, or `/dev` sandbox
- **Container**: card-expanded (preferred), card-focus
- **Gameplay**: Persistent idle farm that lives inside expandable customer cards. Plant crops in up to 4 plots; harvest them when ready to earn gold; spend gold on plot unlocks, speed upgrades, or yield upgrades.
- **Crops**:
  - Carrot: 5s base growth, 3g base reward
  - Corn: 14s base growth, 5g base reward
  - Pumpkin: 22s base growth, 8g base reward
- **Upgrades**: Speed (reduces growth time by 35% per level), Yield (+2g per level per harvest), Plot unlock (costs 8+4×current unlocked plots).
- **Starting state**: 10 gold, 2 unlocked plots.
- **Persistence scope**: user + customer (each customer has their own farm)
- **Feature flag**: `secretGamesGameFarmEnabled`

### 9. Necromancer (necromancer)
- **Kind**: native, immersive overlay
- **Launch**: Type `necromancer` in global search, or Konami code (↑↑↓↓←→←→BA)
- **Container**: overlay only (960×640 min)
- **Gameplay**: Wave-based overlay battler that uses caseload data as army units. Placeholder — overlay host work pending.
- **Feature flag**: `secretGamesGameNecromancerEnabled`

### 10. Asteroids (asteroids)
- **Kind**: native, immersive overlay
- **Launch**: Type `asteroids` in global search, or hidden UI element click
- **Container**: overlay only (900×560 min)
- **Gameplay**: Incoming hazards threaten customer cards on the overlay layer. Placeholder — dedicated host work pending.
- **Feature flag**: `secretGamesGameAsteroidsEnabled`

---

## High Scores

Stored at `userExtras.gameHighScores.*`. Keys defined in `games/highScores.ts`:

| Key | Game |
|-----|------|
| `runner` | Runner |
| `snake` | Snake |
| `space_invaders` | 1945 / Space Invaders |
| `tower_defense` | Tower Defense |
| `bug_game` | Bug Game |

Scores are written on game-over via `buildHighScoreUpdate()` + `updateMe.mutate()`. Only written if the new score beats the old one.

---

## Card Game System (Block Layer)

Separate from the mini-player games, these effects live directly on customer/grant cards:

- **BlockLayerContext** — tracks per-card state: `normal | cracked | shaking | dissolving | fallen | farming | character | error`
- **BlockOverlayLayer** — renders SVG overlays: crack patterns (hp 2=hairline, hp 1=spiderweb), error badges, farm progress bars
- **CardCharacterLayer** — when a card is in `character` mode, the card hides and a floating character sprite appears at the card's position (circle head + triangle body, seeded color, floating name tag)
- **CardPhysicsContext** — card physics for throw/bounce/stack effects

Cards gain a `data-block-id="customer:ID"` and `data-block-name="Client Name"` attribute so the overlay system can locate them in the DOM.

---

## Adding a New Game

1. Add a `SecretGameDefinition` to `SECRET_GAME_DEFINITIONS` in `registry.ts`
2. Add a feature flag entry to `SecretGameFeatureFlags` in `types.ts`
3. Add the game component under `games/<name>/`
4. Add a `featureFlag` key matching `secretGamesGame<PascalId>Enabled`
5. Wire up a launch path in `GameSelector.tsx` or `GameTriggersHost.tsx`
6. Update `adminConfig.ts` `createDefaultSecretGamesAdminConfig` if any new trigger type is needed
