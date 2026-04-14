// web/src/features/games/GameEngine.ts
// Pure game logic — no React, no DOM. All state is plain objects.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Platform {
  x: number;        // viewport left
  y: number;        // viewport top edge (player stands ON this)
  width: number;
  height: number;
  row: number;      // 0 = topmost (boss row), increases downward
  phantom?: boolean; // synthesized floor with no DOM backing
}

export interface Ladder {
  id: number;
  x: number;       // center X of ladder
  topY: number;    // Y of upper platform surface (top of gap)
  bottomY: number; // Y of lower platform surface (bottom of gap)
  upperRow: number;
  lowerRow: number;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;      // ±ballSpeed
  vy: number;
  row: number;     // current floor row, -1 = airborne/falling
  radius: number;
  rotation: number; // visual rotation angle in radians
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lives: number;
  state: 'walking' | 'climbing' | 'jumping' | 'falling' | 'dead';
  onRow: number;            // -1 = airborne
  ladderX: number | null;   // X center of ladder being climbed
  ladderLowerRow: number;   // which ladder gap we're in
  invincibleFrames: number;
  animFrame: number;        // 0-7 walk cycle
  facing: 1 | -1;          // 1=right, -1=left
}

export interface Boss {
  x: number;
  y: number;
  throwTimer: number;
  animPhase: 'idle' | 'wind' | 'throw';
  windFrames: number;
  nextBallId: number;
}

export interface GameState {
  phase: 'playing' | 'levelwin' | 'gameover';
  platforms: Platform[];
  ladders: Ladder[];
  balls: Ball[];
  player: Player;
  boss: Boss;
  score: number;
  tick: number;
  level: number;
  levelWinFrames: number;
  // level params
  maxBalls: number;
  throwInterval: number;
  ballSpeed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PLAYER_W = 16;
export const PLAYER_H = 26;
export const BALL_RADIUS = 9;
const GRAVITY = 0.48;
const PLAYER_SPEED = 3.5;
const PLAYER_JUMP_VY = -11;
const CLIMB_SPEED = 2.8;
const LADDER_GRAB_RANGE = 22; // px from ladder center to grab it
const BOSS_WIN_RANGE = 60;    // px from boss to win level
const LEVEL_WIN_FRAMES = 100; // 100 ticks of "level complete" display before advancing
const MIN_ROWS = 3;

// ─── Level params ─────────────────────────────────────────────────────────────

function levelParams(level: number) {
  return {
    maxBalls: Math.min(1 + Math.floor((level - 1) * 0.7), 5),
    throwInterval: Math.max(55, 200 - (level - 1) * 18),
    ballSpeed: Math.min(1.8 + (level - 1) * 0.35, 5.0),
  };
}

// ─── Platform helpers ─────────────────────────────────────────────────────────

/** Group flat platform list into rows (sorted top→bottom). */
function rowGroups(platforms: Platform[]): Map<number, Platform[]> {
  const map = new Map<number, Platform[]>();
  for (const p of platforms) {
    const arr = map.get(p.row) ?? [];
    arr.push(p);
    map.set(p.row, arr);
  }
  return map;
}

/** X extent of a row (left edge to right edge). */
function rowExtent(platforms: Platform[]): { left: number; right: number } {
  const left = Math.min(...platforms.map((p) => p.x));
  const right = Math.max(...platforms.map((p) => p.x + p.width));
  return { left, right };
}

/** Y surface of a row (the top edge of the first platform in the row). */
function rowSurface(platforms: Platform[]): number {
  return Math.min(...platforms.map((p) => p.y));
}

/** Find which platform (if any) the given x falls on in this row. */
function platformAt(platforms: Platform[], x: number): Platform | null {
  return platforms.find((p) => x >= p.x && x <= p.x + p.width) ?? null;
}

// ─── Build ladders ────────────────────────────────────────────────────────────

/**
 * Build ladders between consecutive floor rows.
 * - 2 ladders per gap (at 30% and 70% of shared X range)
 * - Ladders span exactly from lower floor surface to upper floor surface
 * - Only placed where both rows have card coverage at that X
 */
export function buildLadders(platforms: Platform[]): Ladder[] {
  const groups = rowGroups(platforms);
  const sortedRows = Array.from(groups.keys()).sort((a, b) => a - b);
  const ladders: Ladder[] = [];
  let id = 0;

  for (let i = 0; i < sortedRows.length - 1; i++) {
    const upperRowIdx = sortedRows[i];
    const lowerRowIdx = sortedRows[i + 1];
    const upperPlatforms = groups.get(upperRowIdx)!;
    const lowerPlatforms = groups.get(lowerRowIdx)!;

    const up = rowExtent(upperPlatforms);
    const lo = rowExtent(lowerPlatforms);

    // Shared X range between the two rows
    const sharedLeft = Math.max(up.left, lo.left) + 40;
    const sharedRight = Math.min(up.right, lo.right) - 40;

    if (sharedRight - sharedLeft < 60) continue; // rows don't overlap enough

    const upperSurface = rowSurface(upperPlatforms);
    const lowerSurface = rowSurface(lowerPlatforms);

    // Place 2 ladders at 30% and 70% of shared range
    for (const frac of [0.30, 0.70]) {
      const lx = sharedLeft + (sharedRight - sharedLeft) * frac;
      ladders.push({
        id: id++,
        x: lx,
        topY: upperSurface,   // top of upper floor (top of gap)
        bottomY: lowerSurface, // top of lower floor (bottom of gap)
        upperRow: upperRowIdx,
        lowerRow: lowerRowIdx,
      });
    }
  }

  return ladders;
}

// ─── Phantom floor injection ──────────────────────────────────────────────────

/**
 * If there are fewer than MIN_ROWS floors, append phantom floors below.
 * Each phantom floor is a single wide platform matching viewport width.
 */
export function padPlatforms(platforms: Platform[], viewportW: number, viewportH: number): Platform[] {
  const groups = rowGroups(platforms);
  const rowCount = groups.size;
  if (rowCount >= MIN_ROWS) return platforms;

  const sorted = Array.from(groups.keys()).sort((a, b) => a - b);
  const lastRow = sorted[sorted.length - 1] ?? 0;
  const lastPlatforms = groups.get(lastRow)!;
  const lastSurface = rowSurface(lastPlatforms);

  const result = [...platforms];
  const cardH = lastPlatforms[0]?.height ?? 80;
  const gap = 24;

  for (let extra = 0; extra < MIN_ROWS - rowCount; extra++) {
    const row = lastRow + extra + 1;
    const y = Math.min(lastSurface + (extra + 1) * (cardH + gap), viewportH - cardH - 20);
    result.push({
      x: 40,
      y,
      width: viewportW - 80,
      height: cardH,
      row,
      phantom: true,
    });
  }

  return result;
}

// ─── Init game ────────────────────────────────────────────────────────────────

export function initGame(
  platforms: Platform[],
  level = 1,
  prevScore = 0,
): GameState {
  const params = levelParams(level);
  const groups = rowGroups(platforms);
  const sortedRows = Array.from(groups.keys()).sort((a, b) => a - b);

  // Boss spawns at top-left of topmost floor
  const topRow = sortedRows[0] ?? 0;
  const topPlatforms = groups.get(topRow) ?? platforms;
  const topSurface = rowSurface(topPlatforms);
  const topExtent = rowExtent(topPlatforms);
  const bossX = topExtent.left + 10;
  const bossY = topSurface - 44; // sits above platform surface

  // Player spawns at center-bottom of lowest floor
  const bottomRow = sortedRows[sortedRows.length - 1] ?? 0;
  const bottomPlatforms = groups.get(bottomRow) ?? platforms;
  const bottomSurface = rowSurface(bottomPlatforms);
  const bottomExtent = rowExtent(bottomPlatforms);
  const playerStartX = bottomExtent.left + (bottomExtent.right - bottomExtent.left) / 2 - PLAYER_W / 2;
  const playerStartY = bottomSurface - PLAYER_H;

  const ladders = buildLadders(platforms);

  return {
    phase: 'playing',
    platforms,
    ladders,
    balls: [],
    player: {
      x: playerStartX,
      y: playerStartY,
      vx: 0,
      vy: 0,
      lives: 3,
      state: 'falling',
      onRow: -1,
      ladderX: null,
      ladderLowerRow: -1,
      invincibleFrames: 0,
      animFrame: 0,
      facing: 1,
    },
    boss: {
      x: bossX,
      y: bossY,
      throwTimer: params.throwInterval,
      animPhase: 'idle',
      windFrames: 0,
      nextBallId: 0,
    },
    score: prevScore,
    tick: 0,
    level,
    levelWinFrames: 0,
    ...params,
  };
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

export function tick(state: GameState, keys: Set<string>): GameState {
  if (state.phase === 'gameover') return state;

  // Level win cooldown
  if (state.phase === 'levelwin') {
    const lw = state.levelWinFrames - 1;
    if (lw <= 0) {
      // Advance level — reinit with same platforms but harder
      return initGame(state.platforms, state.level + 1, state.score);
    }
    return { ...state, levelWinFrames: lw };
  }

  let { balls, player, boss, score, tick, ladders, platforms } = state;
  const { ballSpeed, maxBalls, throwInterval } = state;

  tick = tick + 1;
  score = score + 1;

  // ── Boss ──────────────────────────────────────────────────────────────────
  boss = { ...boss };
  boss.throwTimer -= 1;

  if (boss.animPhase === 'idle' && boss.throwTimer <= 20) {
    boss.animPhase = 'wind';
    boss.windFrames = 20;
  }
  if (boss.animPhase === 'wind') {
    boss.windFrames -= 1;
    if (boss.windFrames <= 0) {
      boss.animPhase = 'throw';
    }
  }
  if (boss.animPhase === 'throw') {
    if (balls.length < maxBalls) {
      // Spawn ball from boss position rolling right
      const newBall: Ball = {
        id: boss.nextBallId++,
        x: boss.x + 40,
        y: boss.y + 20,
        vx: ballSpeed,
        vy: 0,
        row: -1, // will land on topmost row
        radius: BALL_RADIUS,
        rotation: 0,
      };
      balls = [...balls, newBall];
    }
    boss.throwTimer = throwInterval;
    boss.animPhase = 'idle';
  }

  // ── Balls ─────────────────────────────────────────────────────────────────
  const groups = rowGroups(platforms);
  const sortedRows = Array.from(groups.keys()).sort((a, b) => a - b);

  balls = balls
    .map((b): Ball => {
      let { x, y, vx, vy, row, rotation } = b;

      // Apply gravity when airborne
      if (row === -1) {
        vy += GRAVITY;
      }

      x += vx;
      y += vy;
      rotation += vx > 0 ? 0.12 : -0.12;

      // If airborne, check if landing on a floor
      if (row === -1 || vy > 0) {
        for (const rowIdx of sortedRows) {
          const rPlatforms = groups.get(rowIdx)!;
          const surface = rowSurface(rPlatforms);
          const platform = platformAt(rPlatforms, x);
          if (platform && y + b.radius >= surface && y - b.radius < surface + 4 && vy >= 0) {
            // Land on this floor
            y = surface - b.radius;
            vy = 0;
            row = rowIdx;
            // Reverse direction on landing (zigzag DK style)
            vx = -vx;
            break;
          }
        }
      }

      // If on a floor, check roll-off edges
      if (row !== -1) {
        const rPlatforms = groups.get(row)!;
        const platform = platformAt(rPlatforms, x);
        if (!platform) {
          // Rolled off edge — enter freefall
          vy = 0.5;
          row = -1;
          // direction already reversed on land, so when it hits next floor it'll reverse again
          // This gives proper zigzag
        }
      }

      return { ...b, x, y, vx, vy, row, rotation };
    })
    .filter((b) => b.y < window.innerHeight + 100); // remove off-screen balls

  // ── Player ────────────────────────────────────────────────────────────────
  player = { ...player };

  const onGround = player.onRow !== -1;
  const onLadder = player.state === 'climbing';

  // Reduce invincibility
  if (player.invincibleFrames > 0) player.invincibleFrames -= 1;

  // Input
  const left = keys.has('ArrowLeft');
  const right = keys.has('ArrowRight');
  const up = keys.has('ArrowUp');
  const down = keys.has('ArrowDown');
  const space = keys.has(' ');

  // Check if player is near any ladder
  const nearLadder = ladders.find((l) => {
    const cx = player.x + PLAYER_W / 2;
    return (
      Math.abs(cx - l.x) < LADDER_GRAB_RANGE &&
      player.y + PLAYER_H >= l.topY - 10 &&
      player.y <= l.bottomY
    );
  }) ?? null;

  // Ladder boarding
  if (!onLadder && nearLadder && (up || down)) {
    player.state = 'climbing';
    player.ladderX = nearLadder.x;
    player.ladderLowerRow = nearLadder.lowerRow;
    player.vx = 0;
    player.vy = 0;
  }

  if (onLadder) {
    player.x = (player.ladderX ?? player.x) - PLAYER_W / 2;
    player.vy = up ? -CLIMB_SPEED : down ? CLIMB_SPEED : 0;
    player.vx = 0;

    // Dismount at top
    const activeLadder = ladders.find((l) => Math.abs((player.x + PLAYER_W / 2) - l.x) < 5);
    if (activeLadder && player.y + PLAYER_H / 2 <= activeLadder.topY + 4) {
      player.state = 'falling';
      player.onRow = activeLadder.upperRow;
      const upper = groups.get(activeLadder.upperRow)!;
      player.y = rowSurface(upper) - PLAYER_H;
      player.ladderX = null;
    }
    // Dismount at bottom
    if (activeLadder && player.y + PLAYER_H >= activeLadder.bottomY - 2) {
      player.state = 'walking';
      player.onRow = activeLadder.lowerRow;
      const lower = groups.get(activeLadder.lowerRow)!;
      player.y = rowSurface(lower) - PLAYER_H;
      player.ladderX = null;
    }
  } else {
    // Horizontal movement
    if (left) { player.vx = -PLAYER_SPEED; player.facing = -1; }
    else if (right) { player.vx = PLAYER_SPEED; player.facing = 1; }
    else { player.vx *= 0.6; if (Math.abs(player.vx) < 0.1) player.vx = 0; }

    // Jump
    if (space && onGround && player.state !== 'jumping') {
      player.vy = PLAYER_JUMP_VY;
      player.state = 'jumping';
      player.onRow = -1;
    }

    // Gravity
    if (!onGround) player.vy += GRAVITY;

    player.x += player.vx;
    player.y += player.vy;

    // Floor collision
    let landed = false;
    for (const rowIdx of sortedRows) {
      const rPlatforms = groups.get(rowIdx)!;
      const surface = rowSurface(rPlatforms);
      const platform = platformAt(rPlatforms, player.x + PLAYER_W / 2);
      if (
        platform &&
        player.vy >= 0 &&
        player.y + PLAYER_H >= surface &&
        player.y + PLAYER_H <= surface + Math.abs(player.vy) + 8
      ) {
        player.y = surface - PLAYER_H;
        player.vy = 0;
        player.onRow = rowIdx;
        if (player.state === 'jumping' || player.state === 'falling') {
          player.state = 'walking';
        }
        landed = true;
        break;
      }
    }

    // Check if walked off edge
    if (!landed && player.state === 'walking') {
      const rPlatforms = groups.get(player.onRow);
      const currentPlatform = rPlatforms ? platformAt(rPlatforms, player.x + PLAYER_W / 2) : null;
      if (!currentPlatform) {
        player.onRow = -1;
        player.state = 'falling';
      }
    }

    // Clamp to viewport
    player.x = Math.max(0, Math.min(window.innerWidth - PLAYER_W, player.x));

    // If player falls below viewport, respawn at bottom
    if (player.y > window.innerHeight + 100) {
      player.lives -= 1;
      if (player.lives <= 0) {
        return { ...state, phase: 'gameover', player: { ...player, lives: 0, state: 'dead' }, score, tick, balls, boss };
      }
      const botRow = sortedRows[sortedRows.length - 1];
      const botPlatforms = groups.get(botRow)!;
      const botSurface = rowSurface(botPlatforms);
      const botExtent = rowExtent(botPlatforms);
      player.x = botExtent.left + (botExtent.right - botExtent.left) / 2 - PLAYER_W / 2;
      player.y = botSurface - PLAYER_H;
      player.vy = 0;
      player.vx = 0;
      player.onRow = botRow;
      player.state = 'walking';
      player.invincibleFrames = 90;
    }
  }

  // Walking animation
  if (player.state === 'walking' && Math.abs(player.vx) > 0.5) {
    if (tick % 6 === 0) player.animFrame = (player.animFrame + 1) % 8;
  } else if (player.state !== 'walking') {
    player.animFrame = 0;
  }

  // ── Player-ball collision ─────────────────────────────────────────────────
  if (player.invincibleFrames === 0 && player.state !== 'dead') {
    const px = player.x + PLAYER_W / 2;
    const py = player.y + PLAYER_H / 2;
    const hitRadius = PLAYER_W / 2 + BALL_RADIUS - 4;
    const hit = balls.some((b) => {
      const dx = b.x - px;
      const dy = b.y - py;
      return Math.sqrt(dx * dx + dy * dy) < hitRadius;
    });
    if (hit) {
      player.lives -= 1;
      player.invincibleFrames = 90;
      if (player.lives <= 0) {
        return { ...state, phase: 'gameover', player: { ...player, lives: 0, state: 'dead' }, score, tick, balls, boss };
      }
    }
  }

  // ── Win condition ─────────────────────────────────────────────────────────
  if (player.onRow === sortedRows[0]) {
    const bossLeft = boss.x;
    const bossRight = boss.x + 44;
    const pCenter = player.x + PLAYER_W / 2;
    if (pCenter >= bossLeft - BOSS_WIN_RANGE && pCenter <= bossRight + BOSS_WIN_RANGE) {
      score += 500 + state.level * 100;
      return {
        ...state, phase: 'levelwin', levelWinFrames: LEVEL_WIN_FRAMES,
        player, balls, boss, score, tick,
      };
    }
  }

  return { ...state, balls, player, boss, score, tick };
}
