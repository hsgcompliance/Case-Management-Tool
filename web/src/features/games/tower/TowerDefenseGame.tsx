"use client";

import React from "react";
import { useMe, useUpdateMe } from "@hooks/useUsers";
import { buildHighScoreUpdate, GAME_SCORE_KEYS, getGameHighScore } from "../highScores";
import { markGameActive, shouldHandleGlobalGameKey, usePauseOnHidden } from "../input";

// ── Types ─────────────────────────────────────────────────────────────────────

type MapTheme = "tron" | "grass";
type TowerType = "pulse" | "cannon" | "frost" | "laser";
type EnemyKind = "runner" | "brute" | "phase" | "boss" | "balloon" | "megaboss" | "miniboss";
type UpgradeKind = "power" | "range" | "speed";
type Point = { x: number; y: number };
type PathInfo = { points: Point[]; segLens: number[]; total: number };

type Enemy = {
  id: number;
  kind: EnemyKind;
  dist: number;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  radius: number;
  slowPct: number;
  slowTime: number;
  phaseDodge: number;
};

type Tower = {
  id: number;
  type: TowerType;
  x: number;
  y: number;
  cooldown: number;
  powerLevel: number;
  rangeLevel: number;
  speedLevel: number;
};

type Projectile = {
  id: number;
  x1: number; y1: number;
  x2: number; y2: number;
  type: TowerType;
  age: number;
  maxAge: number;
  // laser-specific: pierce count remaining
  pierceLeft?: number;
};

type SpawnEntry = { at: number; kind: EnemyKind };

type GameState = {
  running: boolean;
  gameOver: boolean;
  waveActive: boolean;
  round: number;
  autoTimer: number;
  waveClock: number;
  money: number;
  lives: number;
  speed: number;
  mapTheme: MapTheme;
  buildMode: TowerType | null;
  selectedTowerId: number | null;
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  spawnQueue: SpawnEntry[];
  nextId: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const WORLD_W = 900;
const WORLD_H = 520;
const PATH_WIDTH = 36;
const START_MONEY = 300;
const START_LIVES = 10;
const MAX_UPGRADE_LEVEL = 3;
const MAX_LIVES = 15;

// Round at which old boss becomes a "normal heavy" and megaboss appears on boss waves
const MEGABOSS_ROUND_THRESHOLD = 20;
// Round at which the laser tower unlocks
const LASER_UNLOCK_ROUND = 30;

const BASE_BUILD_COST: Record<TowerType, number> = {
  pulse: 75,
  cannon: 140,
  frost: 115,
  laser: 260,
};

function buildCostForRound(type: TowerType, round: number): number {
  const tier = Math.floor(round / 10);
  return Math.round(BASE_BUILD_COST[type] * (1 + tier * 0.35));
}

// ── Enemy definitions ─────────────────────────────────────────────────────────

const ENEMY_BASE: Record<EnemyKind, { hp: number; speed: number; reward: number; radius: number; phaseDodge: number }> = {
  runner:   { hp: 26,   speed: 72,  reward: 5,   radius: 8,  phaseDodge: 0    },
  brute:    { hp: 88,   speed: 42,  reward: 12,  radius: 13, phaseDodge: 0    },
  phase:    { hp: 46,   speed: 62,  reward: 9,   radius: 9,  phaseDodge: 0.32 },
  boss:     { hp: 520,  speed: 30,  reward: 55,  radius: 20, phaseDodge: 0    },
  balloon:  { hp: 10,   speed: 102, reward: 2,   radius: 5,  phaseDodge: 0    },
  megaboss: { hp: 1400, speed: 22,  reward: 140, radius: 28, phaseDodge: 0    },
  miniboss: { hp: 260,  speed: 36,  reward: 35,  radius: 16, phaseDodge: 0    },
};

// Circle fill/stroke colors for enemies (inline styles, Tailwind-purge safe)
const ENEMY_FILL: Record<EnemyKind, string> = {
  runner:   "#22c55e",
  balloon:  "#fbbf24",
  phase:    "#a78bfa",
  brute:    "#f97316",
  boss:     "#dc2626",
  megaboss: "#7c3aed",
  miniboss: "#be185d",
};
const ENEMY_STROKE: Record<EnemyKind, string> = {
  runner:   "#15803d",
  balloon:  "#b45309",
  phase:    "#6d28d9",
  brute:    "#9a3412",
  boss:     "#7f1d1d",
  megaboss: "#4c1d95",
  miniboss: "#831843",
};

// Projectile colors
const PROJ_COLOR: Record<TowerType, string> = {
  pulse:  "#fbbf24",
  cannon: "#ef4444",
  frost:  "#67e8f9",
  laser:  "#a3e635",
};

// ── Tower definitions ─────────────────────────────────────────────────────────

const TOWER_BASE: Record<TowerType, { damage: number; range: number; fireRate: number; splash: number; slow: number; slowDuration: number }> = {
  pulse:  { damage: 9,  range: 122, fireRate: 2.1,  splash: 0,  slow: 0,    slowDuration: 0    },
  cannon: { damage: 26, range: 110, fireRate: 0.88, splash: 42, slow: 0,    slowDuration: 0    },
  frost:  { damage: 5,  range: 134, fireRate: 1.65, splash: 0,  slow: 0.36, slowDuration: 1.05 },
  // Laser: continuous beam that deals damage per tick, pierce count scales with speedLevel
  laser:  { damage: 18, range: 180, fireRate: 4.0,  splash: 0,  slow: 0,    slowDuration: 0    },
};

// ── Path definitions ──────────────────────────────────────────────────────────

const TRON_PATH_POINTS: Point[] = [
  { x: 24, y: 92 }, { x: 288, y: 92 }, { x: 288, y: 212 },
  { x: 626, y: 212 }, { x: 626, y: 332 }, { x: 286, y: 332 },
  { x: 286, y: 434 }, { x: 874, y: 434 },
];

const GRASS_PATH_POINTS: Point[] = [
  // Looped square: shorter route with clearer tower build lanes.
  { x: 40, y: 100 }, { x: 840, y: 100 }, { x: 840, y: 420 },
  { x: 180, y: 420 }, { x: 180, y: 200 }, { x: 680, y: 200 },
  { x: 680, y: 280 }, { x: 874, y: 280 },
];

// ── Path utilities ────────────────────────────────────────────────────────────

function distance(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function distToSegment(p: Point, a: Point, b: Point) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (!l2) return distance(p, a);
  const t = clamp(((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2, 0, 1);
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}
function buildPath(points: Point[]): PathInfo {
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = distance(points[i - 1], points[i]);
    segLens.push(len);
    total += len;
  }
  return { points, segLens, total };
}
const PATH_BY_THEME: Record<MapTheme, PathInfo> = {
  tron: buildPath(TRON_PATH_POINTS),
  grass: buildPath(GRASS_PATH_POINTS),
};

function preferredMapTheme(): MapTheme {
  if (typeof window === "undefined") return "grass";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "tron" : "grass";
}

function pointOnPath(path: PathInfo, distPx: number): Point {
  let d = clamp(distPx, 0, path.total);
  for (let i = 1; i < path.points.length; i++) {
    const seg = path.segLens[i - 1];
    if (d <= seg) {
      const a = path.points[i - 1], b = path.points[i];
      const t = seg <= 0 ? 0 : d / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    d -= seg;
  }
  return path.points[path.points.length - 1];
}

// ── Game logic ────────────────────────────────────────────────────────────────

// Returns true if this tower is fully upgraded on all three tracks
function isTowerFullyUpgraded(tower: Tower): boolean {
  return tower.powerLevel >= MAX_UPGRADE_LEVEL &&
    tower.rangeLevel >= MAX_UPGRADE_LEVEL &&
    tower.speedLevel >= MAX_UPGRADE_LEVEL;
}

function towerStats(tower: Tower) {
  const base = TOWER_BASE[tower.type];
  const fullyUpgraded = isTowerFullyUpgraded(tower);
  // Fully upgraded towers get +20% bonus to all stats
  const maxBonus = fullyUpgraded ? 1.2 : 1.0;
  return {
    damage: base.damage * (1 + tower.powerLevel * 0.28) * maxBonus,
    range: base.range * (1 + tower.rangeLevel * 0.12) * maxBonus,
    fireRate: base.fireRate * (1 + tower.speedLevel * 0.20) * maxBonus,
    splash: base.splash > 0 ? (base.splash + tower.powerLevel * 5) * maxBonus : 0,
    slow: base.slow > 0 ? Math.min(0.65, base.slow + tower.powerLevel * 0.03) : 0,
    slowDuration: base.slowDuration > 0 ? base.slowDuration + tower.speedLevel * 0.1 : 0,
    // Laser: how many additional enemies the beam can pierce through (0 = hits one target only)
    laserPierce: tower.type === "laser" ? tower.speedLevel : 0,
  };
}

function createEnemy(kind: EnemyKind, round: number, id: number): Enemy {
  const base = ENEMY_BASE[kind];
  // Exponential HP scaling — ~60× at round 100
  const hpScale = 1 + round * 0.14 + Math.pow(Math.max(0, round - 5) / 14, 2.4) * 0.18;
  const speedScale = 1 + round * 0.0045 + Math.min(0.45, round * 0.0028);
  const bossExtra = (kind === "boss" || kind === "megaboss" || kind === "miniboss") ? 1 + round * 0.012 : 1;
  const hp = Math.round(base.hp * hpScale * bossExtra);
  return {
    id, kind, dist: 0, hp, maxHp: hp,
    speed: base.speed * speedScale,
    reward: Math.max(6, Math.round(base.reward * (0.7 + round * 0.008))),
    radius: base.radius, slowPct: 0, slowTime: 0, phaseDodge: base.phaseDodge,
  };
}

function createWave(round: number): SpawnEntry[] {
  const tier = Math.floor(round / 10);
  const out: SpawnEntry[] = [];
  const isMegaBossRound = round >= MEGABOSS_ROUND_THRESHOLD && round % 10 === 0;

  if (round % 10 === 0) {
    let t = 0;
    const escortCount = 6 + tier * 3;
    for (let i = 0; i < escortCount; i++) {
      // At high rounds, boss-type escorts appear instead of weaker types
      const escortKind: EnemyKind = isMegaBossRound
        ? (i % 3 === 0 ? "boss" : i % 4 === 0 ? "phase" : "brute")
        : (i % 4 === 0 ? "brute" : i % 3 === 0 ? "phase" : "runner");
      out.push({ at: t, kind: escortKind });
      t += 0.28;
    }
    // Megaboss wave: spawn a megaboss instead of a regular boss
    out.push({ at: t + 0.5, kind: isMegaBossRound ? "megaboss" : "boss" });
    t += 1.5;
    for (let i = 0; i < Math.max(5, tier * 3); i++) {
      out.push({ at: t + i * 0.22, kind: i % 2 ? "phase" : "brute" });
    }
    return out;
  }

  const count = Math.round(8 + round * 2.6 + Math.pow(round / 8, 1.45));
  let t = 0;
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    let kind: EnemyKind = "runner";
    if (round > 5 && roll < 0.07 + Math.min(0.22, round * 0.004)) kind = "phase";
    else if (round > 3 && roll < 0.35 + Math.min(0.28, round * 0.012)) kind = "brute";
    else if (round > 1 && roll < 0.52) kind = "balloon";
    // At high rounds, regular "boss" enemies start appearing in non-boss waves as heavies
    else if (round >= MEGABOSS_ROUND_THRESHOLD && roll < 0.08) kind = "boss";
    out.push({ at: t, kind });
    t += Math.max(0.15, 0.52 - round * 0.006);
  }
  return out;
}

function waveClearBonus(round: number): number {
  // Increasing but controlled curve: starts meaningful and scales into late game.
  return Math.round(Math.pow(10, 1.1) * Math.pow(Math.max(1, round), 0.9));
}

function nextUpgradeCost(tower: Tower, kind: UpgradeKind): number | null {
  const lvl = kind === "power" ? tower.powerLevel : kind === "range" ? tower.rangeLevel : tower.speedLevel;
  if (lvl >= MAX_UPGRADE_LEVEL) return null;
  const typeMult = tower.type === "cannon" ? 1.22 : tower.type === "frost" ? 1.12 : tower.type === "laser" ? 1.35 : 1;
  const base = kind === "power" ? 70 : kind === "range" ? 58 : 62;
  return Math.round(base * typeMult * [1, 1.75, 2.7][lvl]);
}

function initialState(): GameState {
  return {
    running: false, gameOver: false, waveActive: false,
    round: 1, autoTimer: 0, waveClock: 0,
    money: START_MONEY, lives: START_LIVES, speed: 1,
    mapTheme: preferredMapTheme(), buildMode: null, selectedTowerId: null,
    towers: [], enemies: [], projectiles: [], spawnQueue: [], nextId: 1,
  };
}

function startWave(state: GameState): GameState {
  if (state.waveActive || state.gameOver) return state;
  return { ...state, running: true, waveActive: true, waveClock: 0, spawnQueue: createWave(state.round) };
}

function tickGame(state: GameState, dtReal: number): GameState {
  if (state.gameOver) return state;
  const dt = dtReal * state.speed;
  let next = { ...state };
  const path = PATH_BY_THEME[next.mapTheme];
  if (!next.running) return next;

  // Auto-start next wave
  if (!next.waveActive && next.autoTimer > 0) {
    next.autoTimer = Math.max(0, next.autoTimer - dt);
    if (next.autoTimer <= 0) next = startWave(next);
  }

  // Spawn
  if (next.waveActive) {
    next.waveClock += dt;
    if (next.spawnQueue.length) {
      const queue = [...next.spawnQueue];
      const spawned: Enemy[] = [];
      let nid = next.nextId;
      while (queue.length && queue[0].at <= next.waveClock) {
        spawned.push(createEnemy(queue.shift()!.kind, next.round, nid++));
      }
      next.spawnQueue = queue;
      if (spawned.length) next.enemies = [...next.enemies, ...spawned];
      next.nextId = nid;
    }
  }

  // Move enemies
  const moved = next.enemies.map((e) => {
    const sp = e.slowTime > 0 ? e.slowPct : 0;
    const slowTime = Math.max(0, e.slowTime - dt);
    return { ...e, dist: e.dist + e.speed * (1 - sp) * dt, slowTime, slowPct: slowTime > 0 ? e.slowPct : 0 };
  });

  // Check end-of-path
  let lives = next.lives;
  const survivors: Enemy[] = [];
  for (const e of moved) {
    if (e.dist >= path.total) {
      lives -= e.kind === "megaboss" ? 8 : e.kind === "boss" ? 5 : e.kind === "miniboss" ? 3 : e.kind === "brute" ? 2 : 1;
    } else {
      survivors.push(e);
    }
  }
  next.lives = lives;
  next.enemies = survivors;
  if (next.lives <= 0) {
    return { ...next, lives: 0, running: false, waveActive: false, gameOver: true, spawnQueue: [], projectiles: [] };
  }

  // Advance existing projectiles
  const aliveProj = next.projectiles.map((p) => ({ ...p, age: p.age + dt })).filter((p) => p.age < p.maxAge);
  const newProj: Projectile[] = [];

  // Tower firing
  const enemies = next.enemies.map((e) => ({ ...e }));
  const towers = next.towers.map((t) => ({ ...t }));
  let nid = next.nextId;

  for (const tower of towers) {
    const stats = towerStats(tower);
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    if (tower.cooldown > 0) continue;

    if (tower.type === "laser") {
      // Laser: hits the furthest-along enemy in range, then pierces through speedLevel more
      const inRange = enemies
        .filter((e) => distance({ x: tower.x, y: tower.y }, pointOnPath(path, e.dist)) <= stats.range)
        .sort((a, b) => b.dist - a.dist);
      if (!inRange.length) continue;

      const pierceCount = 1 + stats.laserPierce; // hits primary + pierce extras
      let targetsHit = 0;
      let lastPos: Point = { x: tower.x, y: tower.y };
      for (const target of inRange) {
        if (targetsHit >= pierceCount) break;
        target.hp -= stats.damage;
        const tPos = pointOnPath(path, target.dist);
        newProj.push({
          id: nid++,
          x1: lastPos.x, y1: lastPos.y,
          x2: tPos.x, y2: tPos.y,
          type: "laser", age: 0, maxAge: 0.12,
          pierceLeft: pierceCount - targetsHit - 1,
        });
        lastPos = tPos;
        targetsHit++;
      }
      tower.cooldown = 1 / stats.fireRate;
      continue;
    }

    const inRange = enemies
      .filter((e) => distance({ x: tower.x, y: tower.y }, pointOnPath(path, e.dist)) <= stats.range)
      .sort((a, b) => b.dist - a.dist);
    if (!inRange.length) continue;

    const target = inRange[0];
    if (target.phaseDodge > 0 && tower.type !== "cannon" && Math.random() < target.phaseDodge) {
      tower.cooldown = 1 / stats.fireRate;
      continue;
    }

    const tPos = pointOnPath(path, target.dist);

    if (tower.type === "cannon") {
      for (const e of enemies) {
        const d = distance(tPos, pointOnPath(path, e.dist));
        if (d <= stats.splash) e.hp -= stats.damage * clamp(1 - d / (stats.splash + 4), 0.35, 1);
      }
      newProj.push({ id: nid++, x1: tower.x, y1: tower.y, x2: tPos.x, y2: tPos.y, type: "cannon", age: 0, maxAge: 0.20 });
    } else {
      target.hp -= stats.damage;
      if (tower.type === "frost" && stats.slow > 0) {
        target.slowPct = Math.max(target.slowPct, clamp(stats.slow, 0, 0.7));
        target.slowTime = Math.max(target.slowTime, stats.slowDuration);
      }
      newProj.push({ id: nid++, x1: tower.x, y1: tower.y, x2: tPos.x, y2: tPos.y, type: tower.type, age: 0, maxAge: 0.10 });
    }
    tower.cooldown = 1 / stats.fireRate;
  }

  // Kill dead enemies + boss/megaboss splits
  const dead: Enemy[] = [];
  const alive = enemies.filter((e) => { if (e.hp <= 0) { dead.push(e); return false; } return true; });
  let money = next.money;
  for (const e of dead) {
    money += e.reward;
    if (e.kind === "boss") {
      // Regular boss splits into balloons
      const n = Math.min(40, 4 + Math.floor(next.round * 0.7));
      for (let i = 0; i < n; i++) {
        const child = createEnemy("balloon", next.round, nid++);
        child.dist = Math.max(0, e.dist - i * 7);
        child.hp = Math.round(child.hp * 0.65);
        child.maxHp = child.hp;
        alive.push(child);
      }
    } else if (e.kind === "megaboss") {
      // Megaboss splits into multiple minibosses that further split into balloons when killed
      const minibossCount = 3 + Math.floor(next.round / 10);
      for (let i = 0; i < minibossCount; i++) {
        const mb = createEnemy("miniboss", next.round, nid++);
        mb.dist = Math.max(0, e.dist - i * 12);
        alive.push(mb);
      }
    } else if (e.kind === "miniboss") {
      // Miniboss splits into a few bosses
      const bossCount = 2;
      for (let i = 0; i < bossCount; i++) {
        const b = createEnemy("boss", next.round, nid++);
        b.dist = Math.max(0, e.dist - i * 10);
        b.hp = Math.round(b.hp * 0.5);
        b.maxHp = b.hp;
        alive.push(b);
      }
    }
  }

  next.money = money;
  next.nextId = nid;
  next.towers = towers;
  next.enemies = alive;
  next.projectiles = [...aliveProj, ...newProj];

  if (next.waveActive && !next.spawnQueue.length && !next.enemies.length) {
    const completedWave = next.round;
    next.money += waveClearBonus(completedWave);
    // Bonus life on every boss wave (every 10 rounds), capped at MAX_LIVES
    if (completedWave % 10 === 0) {
      next.lives = Math.min(MAX_LIVES, next.lives + 1);
    }
    next.waveActive = false;
    next.round += 1;
    next.autoTimer = 2.2;
  }
  return next;
}

function upgradeTower(state: GameState, towerId: number, kind: UpgradeKind): GameState {
  const towers = state.towers.map((t) => ({ ...t }));
  const idx = towers.findIndex((t) => t.id === towerId);
  if (idx < 0) return state;
  const tower = towers[idx];
  const cost = nextUpgradeCost(tower, kind);
  if (!cost || state.money < cost) return state;
  if (kind === "power") tower.powerLevel++;
  else if (kind === "range") tower.rangeLevel++;
  else tower.speedLevel++;
  return { ...state, towers, money: state.money - cost };
}

// ── SVG sub-components ────────────────────────────────────────────────────────

function TowerSVG({ tower, selected, range }: { tower: Tower; selected: boolean; range: number }) {
  const { x, y, type } = tower;
  const sz = 26, hs = sz / 2;
  const fullyUpgraded = isTowerFullyUpgraded(tower);

  const rangeColor = type === "pulse" ? "#f59e0b" : type === "cannon" ? "#ef4444" : type === "laser" ? "#a3e635" : "#67e8f9";
  const selRing = selected ? <circle cx={x} cy={y} r={range} fill="none" stroke={rangeColor} strokeOpacity={0.22} strokeWidth={1.5} strokeDasharray="6 4" /> : null;

  // Shared "fully upgraded" X overlay — drawn on top of any tower shape
  const fullyUpgradedOverlay = fullyUpgraded ? (
    <g opacity={0.85}>
      <line x1={x - hs + 2} y1={y - hs + 2} x2={x + hs - 2} y2={y + hs - 2}
        stroke="#facc15" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={x + hs - 2} y1={y - hs + 2} x2={x - hs + 2} y2={y + hs - 2}
        stroke="#facc15" strokeWidth={2.5} strokeLinecap="round" />
      {/* Gold glow ring */}
      <circle cx={x} cy={y} r={hs + 5} fill="none" stroke="#facc15" strokeWidth={1} strokeOpacity={0.5}
        strokeDasharray="4 3" />
    </g>
  ) : null;

  if (type === "laser") {
    // Hexagonal laser tower with green accent
    const hex = (r: number) => {
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push(`${x + r * Math.cos(a)},${y + r * Math.sin(a)}`);
      }
      return pts.join(" ");
    };
    return (
      <g>
        {selRing}
        <polygon points={hex(hs + 3)} fill="#052e16" opacity={0.9} />
        <polygon points={hex(hs)} fill="#166534" />
        <polygon points={hex(hs - 4)} fill="#15803d" />
        {/* Emitter core */}
        <circle cx={x} cy={y} r={4} fill="#a3e635" opacity={0.9} />
        <circle cx={x} cy={y} r={2} fill="#ecfccb" />
        {/* Glow */}
        <circle cx={x} cy={y} r={hs + 2} fill="none" stroke="#a3e635" strokeOpacity={0.25} strokeWidth={2} />
        {selected && <polygon points={hex(hs + 2)} fill="none" stroke="#a3e635" strokeWidth={2} />}
        {fullyUpgradedOverlay}
      </g>
    );
  }

  if (type === "pulse") {
    return (
      <g>
        {selRing}
        {/* Glow halo */}
        <rect x={x - hs - 3} y={y - hs - 3} width={sz + 6} height={sz + 6} rx={5} fill="#f59e0b" opacity={0.18} />
        {/* Body */}
        <rect x={x - hs} y={y - hs} width={sz} height={sz} rx={3} fill="#78350f" />
        <rect x={x - hs + 2} y={y - hs + 2} width={sz - 4} height={sz - 4} rx={2} fill="#f59e0b" />
        {/* Inner core */}
        <rect x={x - 4} y={y - 4} width={8} height={8} rx={1} fill="#fef3c7" opacity={0.85} />
        {selected && <rect x={x - hs - 2} y={y - hs - 2} width={sz + 4} height={sz + 4} rx={4} fill="none" stroke="#fbbf24" strokeWidth={2} />}
        {fullyUpgradedOverlay}
      </g>
    );
  }

  if (type === "cannon") {
    return (
      <g transform={`rotate(45, ${x}, ${y})`}>
        {selRing}
        <rect x={x - hs - 3} y={y - hs - 3} width={sz + 6} height={sz + 6} rx={5} fill="#ef4444" opacity={0.15} />
        <rect x={x - hs} y={y - hs} width={sz} height={sz} rx={3} fill="#3b0000" />
        <rect x={x - hs + 2} y={y - hs + 2} width={sz - 4} height={sz - 4} rx={2} fill="#991b1b" />
        <rect x={x - 4} y={y - 4} width={8} height={8} rx={1} fill="#fca5a5" opacity={0.7} />
        {selected && <rect x={x - hs - 2} y={y - hs - 2} width={sz + 4} height={sz + 4} rx={4} fill="none" stroke="#ef4444" strokeWidth={2} />}
        {fullyUpgradedOverlay}
      </g>
    );
  }

  // frost — upward-pointing triangle
  const r = hs + 3;
  const outer = `${x},${y - r} ${x + r * 0.866},${y + r * 0.5} ${x - r * 0.866},${y + r * 0.5}`;
  const ri = r - 4;
  const inner = `${x},${y - ri} ${x + ri * 0.866},${y + ri * 0.5} ${x - ri * 0.866},${y + ri * 0.5}`;
  return (
    <g>
      {selRing}
      <polygon points={outer} fill="#083344" />
      <polygon points={inner} fill="#0891b2" />
      <polygon points={`${x},${y - 5} ${x + 4.5},${y + 3} ${x - 4.5},${y + 3}`} fill="#e0f2fe" opacity={0.75} />
      {selected && <polygon points={outer} fill="none" stroke="#67e8f9" strokeWidth={2} />}
      {fullyUpgradedOverlay}
    </g>
  );
}

function TowerGhost({ x, y, type, valid }: { x: number; y: number; type: TowerType; valid: boolean }) {
  const hs = 13;
  const fill = valid
    ? (type === "pulse" ? "#f59e0b" : type === "cannon" ? "#991b1b" : type === "laser" ? "#15803d" : "#0891b2")
    : "#ef4444";
  const stroke = valid ? fill : "#ef4444";
  const opacity = valid ? 0.7 : 0.4;
  if (type === "pulse") {
    return <rect x={x - hs} y={y - hs} width={hs * 2} height={hs * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={1.5} opacity={opacity} />;
  }
  if (type === "cannon") {
    return (
      <g transform={`rotate(45, ${x}, ${y})`} opacity={opacity}>
        <rect x={x - hs} y={y - hs} width={hs * 2} height={hs * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={1.5} />
      </g>
    );
  }
  if (type === "laser") {
    const hex: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      hex.push(`${x + hs * Math.cos(a)},${y + hs * Math.sin(a)}`);
    }
    return <polygon points={hex.join(" ")} fill={fill} stroke={stroke} strokeWidth={1.5} opacity={opacity} />;
  }
  const r = hs + 2;
  const pts = `${x},${y - r} ${x + r * 0.866},${y + r * 0.5} ${x - r * 0.866},${y + r * 0.5}`;
  return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={1.5} opacity={opacity} />;
}

function ProjectileSVG({ proj }: { proj: Projectile }) {
  const progress = clamp(proj.age / proj.maxAge, 0, 1);
  const color = PROJ_COLOR[proj.type];

  if (proj.type === "cannon") {
    const r = progress * 20;
    const a = (1 - progress) * 0.9;
    return (
      <g>
        <circle cx={proj.x2} cy={proj.y2} r={r} fill={color} fillOpacity={a * 0.35} />
        <circle cx={proj.x2} cy={proj.y2} r={r * 0.45} fill={color} fillOpacity={a * 0.75} />
      </g>
    );
  }

  if (proj.type === "laser") {
    // Laser beam: bright green line with glow, fading out
    const a = 1 - progress;
    return (
      <g>
        {/* Outer glow */}
        <line x1={proj.x1} y1={proj.y1} x2={proj.x2} y2={proj.y2}
          stroke="#a3e635" strokeWidth={6} strokeOpacity={a * 0.25} strokeLinecap="round" />
        {/* Core beam */}
        <line x1={proj.x1} y1={proj.y1} x2={proj.x2} y2={proj.y2}
          stroke="#ecfccb" strokeWidth={2} strokeOpacity={a * 0.9} strokeLinecap="round" />
        {/* Hit flash at target */}
        <circle cx={proj.x2} cy={proj.y2} r={4 * (1 - progress)} fill="#a3e635" fillOpacity={a * 0.8} />
      </g>
    );
  }

  const px = proj.x1 + (proj.x2 - proj.x1) * progress;
  const py = proj.y1 + (proj.y2 - proj.y1) * progress;
  const trailP = Math.max(0, progress - 0.25);
  const tx = proj.x1 + (proj.x2 - proj.x1) * trailP;
  const ty = proj.y1 + (proj.y2 - proj.y1) * trailP;
  const a = 1 - progress * 0.3;
  const sw = proj.type === "frost" ? 1.5 : 2.5;
  return (
    <g>
      <line x1={tx} y1={ty} x2={px} y2={py} stroke={color} strokeWidth={sw} strokeOpacity={a * 0.65} strokeLinecap="round" />
      <circle cx={px} cy={py} r={proj.type === "frost" ? 2 : 3} fill={color} fillOpacity={a} />
    </g>
  );
}

function EnemySVG({ enemy, pos }: { enemy: Enemy; pos: Point }) {
  const { kind, radius: r, hp, maxHp, slowTime } = enemy;
  const hpPct = clamp(hp / maxHp, 0, 1);
  const fill = ENEMY_FILL[kind];
  const stroke = ENEMY_STROKE[kind];
  const barColor = hpPct > 0.5 ? "#22c55e" : hpPct > 0.25 ? "#f59e0b" : "#ef4444";
  const { x, y } = pos;

  let sprite: React.ReactNode;
  switch (kind) {

    case "runner":
      // Nimble dart/chevron pointing right — speed lines trailing behind
      sprite = (
        <g>
          <polygon
            points={`${x - r},${y - r * 0.65} ${x + r},${y} ${x - r},${y + r * 0.65}`}
            fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round"
          />
          {/* Eye */}
          <circle cx={x + r * 0.25} cy={y} r={r * 0.23} fill="white" />
          <circle cx={x + r * 0.3} cy={y} r={r * 0.12} fill="#0f172a" />
          {/* Speed dashes */}
          <line x1={x - r * 0.3} y1={y - r * 0.32} x2={x - r * 0.85} y2={y - r * 0.32}
            stroke={stroke} strokeWidth={1} strokeOpacity={0.55} strokeLinecap="round" />
          <line x1={x - r * 0.3} y1={y + r * 0.32} x2={x - r * 0.85} y2={y + r * 0.32}
            stroke={stroke} strokeWidth={1} strokeOpacity={0.55} strokeLinecap="round" />
        </g>
      );
      break;

    case "brute":
      // Heavy armored hulk — thick body, shoulder pads, visor slit
      sprite = (
        <g>
          {/* Body */}
          <rect x={x - r * 0.68} y={y - r * 0.88} width={r * 1.36} height={r * 1.76} rx={3}
            fill={fill} stroke={stroke} strokeWidth={1.8} />
          {/* Shoulder pads */}
          <rect x={x - r} y={y - r * 0.72} width={r * 0.46} height={r * 0.65} rx={2} fill={stroke} />
          <rect x={x + r * 0.54} y={y - r * 0.72} width={r * 0.46} height={r * 0.65} rx={2} fill={stroke} />
          {/* Chest seam */}
          <line x1={x} y1={y - r * 0.55} x2={x} y2={y + r * 0.62}
            stroke="rgba(0,0,0,0.3)" strokeWidth={1.2} />
          {/* Visor slit */}
          <rect x={x - r * 0.42} y={y - r * 0.38} width={r * 0.84} height={r * 0.24} rx={1}
            fill="#fbbf24" fillOpacity={0.85} />
          {/* Knee plates */}
          <rect x={x - r * 0.52} y={y + r * 0.55} width={r * 0.46} height={r * 0.28} rx={1} fill={stroke} fillOpacity={0.7} />
          <rect x={x + r * 0.06} y={y + r * 0.55} width={r * 0.46} height={r * 0.28} rx={1} fill={stroke} fillOpacity={0.7} />
        </g>
      );
      break;

    case "phase":
      // Ghost — rounded dome top, wispy wavy bottom, spooky eyes
      sprite = (
        <g opacity={0.88}>
          <path
            d={`M${x - r},${y} A${r},${r * 1.1} 0 0,1 ${x + r},${y}
                L${x + r},${y + r * 0.75}
                Q${x + r * 0.62},${y + r * 0.35} ${x + r * 0.22},${y + r * 0.75}
                Q${x},${y + r * 0.35} ${x - r * 0.22},${y + r * 0.75}
                Q${x - r * 0.62},${y + r * 0.35} ${x - r},${y + r * 0.75} Z`}
            fill={fill} stroke={stroke} strokeWidth={1.5}
          />
          {/* Eyes */}
          <circle cx={x - r * 0.32} cy={y - r * 0.08} r={r * 0.26} fill="white" />
          <circle cx={x + r * 0.32} cy={y - r * 0.08} r={r * 0.26} fill="white" />
          <circle cx={x - r * 0.28} cy={y - r * 0.04} r={r * 0.13} fill="#1e1b4b" />
          <circle cx={x + r * 0.36} cy={y - r * 0.04} r={r * 0.13} fill="#1e1b4b" />
          {/* Glow eyes */}
          <circle cx={x - r * 0.32} cy={y - r * 0.08} r={r * 0.08} fill="#818cf8" fillOpacity={0.85} />
          <circle cx={x + r * 0.32} cy={y - r * 0.08} r={r * 0.08} fill="#818cf8" fillOpacity={0.85} />
        </g>
      );
      break;

    case "balloon":
      // Hot air balloon with basket and ropes
      sprite = (
        <g>
          {/* Balloon body */}
          <ellipse cx={x} cy={y - r * 0.32} rx={r * 0.9} ry={r * 0.95} fill={fill} stroke={stroke} strokeWidth={1.5} />
          {/* Stripe bands */}
          <ellipse cx={x} cy={y - r * 0.32} rx={r * 0.9} ry={r * 0.25} fill={stroke} fillOpacity={0.35} />
          <ellipse cx={x} cy={y + r * 0.3} rx={r * 0.78} ry={r * 0.18} fill={stroke} fillOpacity={0.25} />
          {/* Top puff cap */}
          <circle cx={x} cy={y - r * 1.22} r={r * 0.18} fill={fill} stroke={stroke} strokeWidth={1} />
          {/* Ropes */}
          <line x1={x - r * 0.55} y1={y + r * 0.58} x2={x - r * 0.3} y2={y + r * 0.68} stroke={stroke} strokeWidth={0.9} />
          <line x1={x + r * 0.55} y1={y + r * 0.58} x2={x + r * 0.3} y2={y + r * 0.68} stroke={stroke} strokeWidth={0.9} />
          {/* Basket */}
          <rect x={x - r * 0.32} y={y + r * 0.68} width={r * 0.64} height={r * 0.5} rx={2}
            fill="#92400e" stroke="#78350f" strokeWidth={1} />
          <line x1={x - r * 0.14} y1={y + r * 0.68} x2={x - r * 0.14} y2={y + r * 1.18}
            stroke="#78350f" strokeWidth={0.8} />
          <line x1={x + r * 0.14} y1={y + r * 0.68} x2={x + r * 0.14} y2={y + r * 1.18}
            stroke="#78350f" strokeWidth={0.8} />
        </g>
      );
      break;

    case "boss":
      // Horned demon skull with glowing eye sockets
      sprite = (
        <g>
          <circle cx={x} cy={y} r={r + 7} fill="#dc2626" fillOpacity={0.18} />
          {/* Horns */}
          <polygon
            points={`${x - r * 0.52},${y - r * 0.72} ${x - r * 0.7},${y - r * 1.45} ${x - r * 0.18},${y - r * 0.82}`}
            fill={stroke} />
          <polygon
            points={`${x + r * 0.52},${y - r * 0.72} ${x + r * 0.7},${y - r * 1.45} ${x + r * 0.18},${y - r * 0.82}`}
            fill={stroke} />
          {/* Skull dome */}
          <ellipse cx={x} cy={y} rx={r * 0.88} ry={r * 0.94} fill={fill} stroke={stroke} strokeWidth={2} />
          {/* Eye sockets */}
          <ellipse cx={x - r * 0.36} cy={y - r * 0.18} rx={r * 0.24} ry={r * 0.3} fill="#450a0a" />
          <ellipse cx={x + r * 0.36} cy={y - r * 0.18} rx={r * 0.24} ry={r * 0.3} fill="#450a0a" />
          {/* Glowing pupils */}
          <ellipse cx={x - r * 0.36} cy={y - r * 0.18} rx={r * 0.12} ry={r * 0.17} fill="#f97316" fillOpacity={0.9} />
          <ellipse cx={x + r * 0.36} cy={y - r * 0.18} rx={r * 0.12} ry={r * 0.17} fill="#f97316" fillOpacity={0.9} />
          {/* Nose cavity */}
          <path d={`M${x - r * 0.1},${y + r * 0.1} L${x},${y + r * 0.3} L${x + r * 0.1},${y + r * 0.1}`}
            fill="#450a0a" />
          {/* Jaw + teeth */}
          <path d={`M${x - r * 0.52},${y + r * 0.35} Q${x},${y + r * 0.75} ${x + r * 0.52},${y + r * 0.35}`}
            stroke={stroke} strokeWidth={1.5} fill="none" strokeLinecap="round" />
          {([-0.32, 0, 0.32] as const).map((ox, i) => (
            <rect key={i} x={x + ox * r - r * 0.1} y={y + r * 0.36} width={r * 0.2} height={r * 0.24} rx={1} fill="white" />
          ))}
        </g>
      );
      break;

    case "megaboss":
      // Dragon head — crown, slitted eyes, fangs
      sprite = (
        <g>
          <circle cx={x} cy={y} r={r + 12} fill="#7c3aed" fillOpacity={0.12} />
          <circle cx={x} cy={y} r={r + 6} fill="#7c3aed" fillOpacity={0.22} />
          {/* Crown spikes */}
          {([-1, 0, 1] as const).map((i) => (
            <polygon key={i}
              points={`${x + i * r * 0.42 - r * 0.14},${y - r} ${x + i * r * 0.42},${y - r - 13 + Math.abs(i) * 3} ${x + i * r * 0.42 + r * 0.14},${y - r}`}
              fill="#c4b5fd" stroke="#7c3aed" strokeWidth={1} />
          ))}
          {/* Scales / body */}
          <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={2.5} />
          {/* Scale texture lines */}
          {([-0.45, 0, 0.45] as const).map((ox, i) => (
            <ellipse key={i} cx={x + ox * r * 0.6} cy={y - r * 0.3} rx={r * 0.22} ry={r * 0.14}
              fill="none" stroke={stroke} strokeWidth={0.8} strokeOpacity={0.6} />
          ))}
          {/* Slit eyes */}
          <ellipse cx={x - r * 0.33} cy={y - r * 0.22} rx={r * 0.27} ry={r * 0.32} fill="#1e1b4b" />
          <ellipse cx={x + r * 0.33} cy={y - r * 0.22} rx={r * 0.27} ry={r * 0.32} fill="#1e1b4b" />
          <ellipse cx={x - r * 0.33} cy={y - r * 0.22} rx={r * 0.1} ry={r * 0.22} fill="#a78bfa" fillOpacity={0.9} />
          <ellipse cx={x + r * 0.33} cy={y - r * 0.22} rx={r * 0.1} ry={r * 0.22} fill="#a78bfa" fillOpacity={0.9} />
          {/* Fangs */}
          <polygon points={`${x - r * 0.42},${y + r * 0.22} ${x - r * 0.28},${y + r * 0.58} ${x - r * 0.12},${y + r * 0.22}`}
            fill="white" stroke={stroke} strokeWidth={0.6} />
          <polygon points={`${x + r * 0.12},${y + r * 0.22} ${x + r * 0.28},${y + r * 0.58} ${x + r * 0.42},${y + r * 0.22}`}
            fill="white" stroke={stroke} strokeWidth={0.6} />
          <text x={x} y={y - r - 18} textAnchor="middle"
            fill="#c4b5fd" fontSize={8} fontFamily="monospace" fontWeight="bold">MEGA</text>
        </g>
      );
      break;

    case "miniboss":
      // Armored knight helmet with plume and visor grill
      sprite = (
        <g>
          <circle cx={x} cy={y} r={r + 4} fill="#be185d" fillOpacity={0.22} />
          {/* Plume */}
          <line x1={x} y1={y - r} x2={x} y2={y - r * 1.65}
            stroke="#f9a8d4" strokeWidth={3.5} strokeLinecap="round" />
          <line x1={x - r * 0.16} y1={y - r * 1.28} x2={x - r * 0.16} y2={y - r * 1.75}
            stroke="#ec4899" strokeWidth={2} strokeLinecap="round" />
          <line x1={x + r * 0.16} y1={y - r * 1.28} x2={x + r * 0.16} y2={y - r * 1.75}
            stroke="#ec4899" strokeWidth={2} strokeLinecap="round" />
          {/* Helm dome */}
          <ellipse cx={x} cy={y - r * 0.14} rx={r * 0.88} ry={r} fill={fill} stroke={stroke} strokeWidth={2} />
          {/* Eye slit */}
          <rect x={x - r * 0.52} y={y - r * 0.36} width={r * 1.04} height={r * 0.21} rx={r * 0.1}
            fill="#450a0a" fillOpacity={0.95} />
          {/* Visor grill bars */}
          {([-0.22, 0, 0.22] as const).map((dy, i) => (
            <line key={i}
              x1={x - r * 0.56} y1={y + dy * r}
              x2={x + r * 0.56} y2={y + dy * r}
              stroke={stroke} strokeWidth={1.3} strokeLinecap="round" />
          ))}
          {/* Cheek guards */}
          <rect x={x - r * 0.88} y={y - r * 0.35} width={r * 0.32} height={r * 0.75} rx={2} fill={stroke} fillOpacity={0.6} />
          <rect x={x + r * 0.56} y={y - r * 0.35} width={r * 0.32} height={r * 0.75} rx={2} fill={stroke} fillOpacity={0.6} />
        </g>
      );
      break;
  }

  return (
    <g>
      {slowTime > 0 && <circle cx={x} cy={y} r={r + 5} fill="#67e8f9" fillOpacity={0.25} />}
      {sprite}
      {/* HP bar */}
      <rect x={x - r} y={y + r + 2} width={r * 2} height={3} rx={1} fill="#1e293b" />
      <rect x={x - r} y={y + r + 2} width={r * 2 * hpPct} height={3} rx={1} fill={barColor} />
    </g>
  );
}

// ── Upgrade panel (floats on the board as foreignObject) ──────────────────────

function UpgradePanel({
  tower, money, onUpgrade, onClose,
}: {
  tower: Tower;
  money: number;
  onUpgrade: (kind: UpgradeKind) => void;
  onClose: () => void;
}) {
  const panelW = 178, panelH = 120;
  const px = clamp(tower.x + 20, 4, WORLD_W - panelW - 4);
  const py = clamp(tower.y - 124, 4, WORLD_H - panelH - 4);
  const fullyUpgraded = isTowerFullyUpgraded(tower);

  return (
    <foreignObject
      x={px} y={py} width={panelW} height={panelH}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontFamily: "system-ui", fontSize: 11, background: "rgba(15,23,42,0.97)", border: "1px solid #334155", borderRadius: 8, padding: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.6)", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
            {tower.type} #{tower.id}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0 }}>✕</button>
        </div>
        {fullyUpgraded && (
          <div style={{ fontSize: 9, color: "#facc15", fontWeight: 700, textAlign: "center", marginBottom: 4, letterSpacing: "0.04em" }}>
            ✕ FULLY UPGRADED — +20% BONUS
          </div>
        )}
        <div style={{ display: "flex", gap: 4 }}>
          {(["power", "range", "speed"] as UpgradeKind[]).map((kind) => {
            const lvl = kind === "power" ? tower.powerLevel : kind === "range" ? tower.rangeLevel : tower.speedLevel;
            const cost = nextUpgradeCost(tower, kind);
            const canAfford = cost != null && money >= cost;
            return (
              <button
                key={kind}
                disabled={!canAfford}
                onClick={() => onUpgrade(kind)}
                style={{
                  flex: 1, padding: "4px 2px", borderRadius: 5, fontSize: 9,
                  fontWeight: 600, lineHeight: 1.4, textAlign: "center",
                  cursor: canAfford ? "pointer" : "default",
                  border: `1px solid ${canAfford ? "#475569" : "#1e293b"}`,
                  background: canAfford ? "#1e293b" : "#0a1322",
                  color: canAfford ? "#e2e8f0" : "#334155",
                }}
              >
                {kind[0].toUpperCase()}<br />
                {lvl}/{MAX_UPGRADE_LEVEL}<br />
                {cost ? `$${cost}` : "MAX"}
              </button>
            );
          })}
        </div>
        {tower.type === "laser" && (
          <div style={{ fontSize: 8, color: "#86efac", marginTop: 4, textAlign: "center" }}>
            Speed upgrades add pierce (+{tower.speedLevel} now)
          </div>
        )}
      </div>
    </foreignObject>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export type TowerDefenseGameProps = {
  embedded?: boolean;
  renderStyle?: "embedded" | "fullscreen";
  onSessionStart?: () => void;
};

export default function TowerDefenseGame({
  embedded = false,
  renderStyle = "embedded",
  onSessionStart,
}: TowerDefenseGameProps) {
  const style = embedded ? "embedded" : renderStyle;
  const rootRef = React.useRef<HTMLElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [state, setState] = React.useState<GameState>(() => initialState());
  const stateRef = React.useRef<GameState>(state);
  const [cursorPos, setCursorPos] = React.useState<Point | null>(null);

  const { data: me } = useMe();
  const meLite = (me as { extras?: Record<string, unknown> | null } | null) || null;
  const updateMe = useUpdateMe();
  const bestWave = React.useMemo(() => getGameHighScore(meLite, GAME_SCORE_KEYS.towerDefenseRound), [meLite]);
  const prevGameOverRef = React.useRef(false);
  const activePath = PATH_BY_THEME[state.mapTheme];

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Game loop
  React.useEffect(() => {
    const timer = window.setInterval(() => setState((prev) => tickGame(prev, 0.04)), 40);
    return () => window.clearInterval(timer);
  }, []);

  // High score save
  React.useEffect(() => {
    if (!state.gameOver || prevGameOverRef.current) { prevGameOverRef.current = state.gameOver; return; }
    const patch = buildHighScoreUpdate(meLite, GAME_SCORE_KEYS.towerDefenseRound, state.round);
    if (patch) updateMe.mutate(patch);
    prevGameOverRef.current = true;
  }, [meLite, state.gameOver, state.round, updateMe]);
  React.useEffect(() => { if (!state.gameOver) prevGameOverRef.current = false; }, [state.gameOver]);

  // Keyboard: Space = start wave / restart, P = pause
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldHandleGlobalGameKey(rootRef.current, event)) return;
      if (event.code === "Space") {
        event.preventDefault();
        const snapshot = stateRef.current;
        if (snapshot.gameOver) {
          onSessionStart?.();
          setState(initialState());
          setCursorPos(null);
          return;
        }
        if (!snapshot.waveActive) setState((prev) => startWave(prev));
      }
      if (event.code === "KeyP") {
        event.preventDefault();
        if (stateRef.current.gameOver) return;
        setState((prev) => ({ ...prev, running: !prev.running }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSessionStart]);

  usePauseOnHidden(() => setState((prev) => ({ ...prev, running: false })));

  // Derived
  const selectedTower = state.selectedTowerId != null
    ? state.towers.find((t) => t.id === state.selectedTowerId) || null : null;
  const progressRound = state.waveActive ? state.round : state.round - 1;
  const laserUnlocked = state.round >= LASER_UNLOCK_ROUND;

  function svgToWorld(event: React.MouseEvent<SVGSVGElement>): Point {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
      y: ((event.clientY - rect.top) / rect.height) * WORLD_H,
    };
  }

  function canPlace(point: Point): boolean {
    if (!state.buildMode) return false;
    if (state.money < buildCostForRound(state.buildMode, state.round)) return false;
    if (point.x < 28 || point.y < 28 || point.x > WORLD_W - 28 || point.y > WORLD_H - 28) return false;
    const onPath = activePath.points.slice(1).some((p, i) =>
      distToSegment(point, activePath.points[i], p) < PATH_WIDTH / 2 + 18
    );
    const tooClose = state.towers.some((t) => distance(point, { x: t.x, y: t.y }) < 36);
    return !onPath && !tooClose;
  }

  function onBoardClick(event: React.MouseEvent<SVGSVGElement>) {
    const point = svgToWorld(event);
    if (state.buildMode) {
      if (!canPlace(point)) return;
      setState((prev) => {
        const cost = buildCostForRound(prev.buildMode!, prev.round);
        return {
          ...prev,
          money: prev.money - cost,
          towers: [...prev.towers, {
            id: prev.nextId, type: prev.buildMode!, x: point.x, y: point.y,
            cooldown: 0.3, powerLevel: 0, rangeLevel: 0, speedLevel: 0,
          }],
          selectedTowerId: prev.nextId,
          nextId: prev.nextId + 1,
          buildMode: null,
        };
      });
      setCursorPos(null);
      return;
    }
    // Select tower — 22px hit radius
    const hit = state.towers.find((t) => distance(point, { x: t.x, y: t.y }) <= 22);
    setState((prev) => ({ ...prev, selectedTowerId: hit ? hit.id : null }));
  }

  const mapBg = state.mapTheme === "tron" ? "#0f172a" : "#bfdcae";
  const mapStroke = state.mapTheme === "tron" ? "#334155" : "#a07850";
  const pathAccent = state.mapTheme === "tron" ? "rgba(99,102,241,0.28)" : "rgba(100,70,30,0.28)";
  const shell = style === "fullscreen"
    ? "h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    : "h-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900";

  // Available tower types for the build bar
  const buildableTowers: TowerType[] = ["pulse", "cannon", "frost"];
  if (laserUnlocked) buildableTowers.push("laser");

  return (
    <section
      ref={rootRef}
      data-game-instance="tower-defense"
      tabIndex={0}
      className={`${shell} flex flex-col overflow-hidden`}
      onPointerDown={(e) => { e.currentTarget.focus(); markGameActive(e.currentTarget); }}
      onFocus={(e) => markGameActive(e.currentTarget)}
    >
      {/* ── HUD ─────────────────────────────────────────────────────────── */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold">Wave {Math.max(0, progressRound)}</span>
          <span>❤️ {state.lives}</span>
          <span>💰 ${state.money}</span>
          <span className="text-slate-500 dark:text-slate-400">Best: {Math.max(bestWave, progressRound)}</span>
          {state.round >= MEGABOSS_ROUND_THRESHOLD && (
            <span className="text-violet-400 font-bold">⚠ Megaboss era</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button"
            className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            onClick={() => setState((prev) => ({ ...prev, running: !prev.running }))}>
            {state.running ? "⏸ Pause" : "▶ Run"}
          </button>
          <button type="button"
            className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            onClick={() => setState((prev) => startWave(prev))}
            disabled={state.waveActive || state.gameOver}>
            ▶▶ Start Wave
          </button>
          <button type="button"
            className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            onClick={() => {
              onSessionStart?.();
              setState(initialState());
              setCursorPos(null);
            }}>
            ↺ Restart
          </button>
        </div>
      </div>

      {/* ── Options row ──────────────────────────────────────────────────── */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Map:</span>
        {(["tron", "grass"] as MapTheme[]).map((theme) => (
          <button key={theme} type="button"
            className={`rounded border px-2 py-0.5 ${state.mapTheme === theme ? "border-slate-600 bg-slate-700 text-white dark:border-slate-400 dark:bg-slate-200 dark:text-slate-900" : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"}`}
            onClick={() => setState((prev) => ({ ...prev, mapTheme: theme }))}
            disabled={state.waveActive || state.enemies.length > 0}>
            {theme === "tron" ? "Difficult" : "Easy"}
          </button>
        ))}
        <span className="ml-2 text-slate-500 dark:text-slate-400">Speed:</span>
        {[1, 2, 3].map((m) => (
          <button key={m} type="button"
            className={`rounded border px-2 py-0.5 ${state.speed === m ? "border-slate-600 bg-slate-700 text-white dark:border-slate-400 dark:bg-slate-200 dark:text-slate-900" : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"}`}
            onClick={() => setState((prev) => ({ ...prev, speed: m }))}>
            {m}×
          </button>
        ))}
        <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500">Space=wave · P=pause</span>
      </div>

      {/* ── Build bar ────────────────────────────────────────────────────── */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-600 font-medium dark:text-slate-200">Build:</span>
        {buildableTowers.map((type) => {
          const cost = buildCostForRound(type, state.round);
          const affordable = state.money >= cost;
          const active = state.buildMode === type;
          return (
            <button key={type} type="button"
              className={`rounded border px-2.5 py-1 transition-colors ${
                active ? "border-blue-500 bg-blue-600 text-white"
                : affordable ? "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                : "border-slate-200 text-slate-400 opacity-60 cursor-not-allowed dark:border-slate-700 dark:text-slate-500"
              }`}
              onClick={() => {
                setState((prev) => ({ ...prev, buildMode: prev.buildMode === type ? null : type, selectedTowerId: null }));
                setCursorPos(null);
              }}>
              {type === "pulse" ? "■ Pulse" : type === "cannon" ? "◆ Cannon" : type === "laser" ? "⬡ Laser" : "▲ Frost"} ${cost}
            </button>
          );
        })}
        {!laserUnlocked && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">⬡ Laser unlocks at wave {LASER_UNLOCK_ROUND}</span>
        )}
        {state.buildMode && (
          <span className="text-[10px] text-slate-400 animate-pulse dark:text-slate-500">Click map to place</span>
        )}
      </div>

      {/* ── Board ────────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden rounded border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-950">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block h-full w-full select-none"
          style={{ cursor: state.buildMode ? "crosshair" : "default", background: mapBg }}
          onClick={onBoardClick}
          onMouseMove={(e) => { if (!state.buildMode) { setCursorPos(null); return; } setCursorPos(svgToWorld(e)); }}
          onMouseLeave={() => setCursorPos(null)}
        >
          <defs>
            {state.mapTheme === "tron" && (
              <pattern id="td-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(148,163,184,0.10)" strokeWidth="1" />
              </pattern>
            )}
          </defs>

          {state.mapTheme === "tron" && <rect width={WORLD_W} height={WORLD_H} fill="url(#td-grid)" />}

          {/* Path fill */}
          <polyline
            fill="none" stroke={mapStroke}
            strokeLinecap="round" strokeLinejoin="round" strokeWidth={PATH_WIDTH}
            points={activePath.points.map((p) => `${p.x},${p.y}`).join(" ")}
          />
          {/* Path dashes */}
          <polyline
            fill="none" stroke={pathAccent} strokeDasharray="10 8" strokeWidth={2}
            points={activePath.points.map((p) => `${p.x},${p.y}`).join(" ")}
          />

          {/* START / EXIT labels */}
          <text x={activePath.points[0].x + 5} y={activePath.points[0].y - 10}
            fill="rgba(255,255,255,0.55)" fontSize={10} fontFamily="monospace">START</text>
          <text x={activePath.points[activePath.points.length - 1].x - 32}
            y={activePath.points[activePath.points.length - 1].y - 10}
            fill="rgba(255,255,255,0.55)" fontSize={10} fontFamily="monospace">EXIT</text>

          {/* Towers */}
          {state.towers.map((tower) => (
            <TowerSVG key={tower.id} tower={tower} selected={tower.id === state.selectedTowerId} range={towerStats(tower).range} />
          ))}

          {/* Projectiles */}
          {state.projectiles.map((proj) => <ProjectileSVG key={proj.id} proj={proj} />)}

          {/* Enemies */}
          {state.enemies.map((enemy) => (
            <EnemySVG key={enemy.id} enemy={enemy} pos={pointOnPath(activePath, enemy.dist)} />
          ))}

          {/* Build ghost */}
          {state.buildMode && cursorPos && (
            <TowerGhost x={cursorPos.x} y={cursorPos.y} type={state.buildMode} valid={canPlace(cursorPos)} />
          )}

          {/* Upgrade panel */}
          {selectedTower && (
            <UpgradePanel
              tower={selectedTower}
              money={state.money}
              onUpgrade={(kind) => setState((prev) => upgradeTower(prev, selectedTower.id, kind))}
              onClose={() => setState((prev) => ({ ...prev, selectedTowerId: null }))}
            />
          )}

          {/* Game over */}
          {state.gameOver && (
            <g>
              <rect width={WORLD_W} height={WORLD_H} fill="rgba(0,0,0,0.68)" />
              <foreignObject x={WORLD_W / 2 - 135} y={WORLD_H / 2 - 60} width={270} height={130}
                onClick={(e) => e.stopPropagation()}>
                <div style={{ fontFamily: "system-ui", textAlign: "center", color: "white", padding: "20px 16px", background: "rgba(15,23,42,0.98)", borderRadius: 12, border: "1px solid #334155" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Defense Failed</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
                    Wave {progressRound} · Best: {Math.max(bestWave, progressRound)}
                  </div>
                  <button onClick={() => {
                    onSessionStart?.();
                    setState(initialState());
                    setCursorPos(null);
                  }}
                    style={{ padding: "7px 22px", borderRadius: 8, background: "#3b82f6", color: "white", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Play Again
                  </button>
                </div>
              </foreignObject>
            </g>
          )}

          {/* Start screen */}
          {!state.running && !state.gameOver && progressRound <= 0 && (
            <g>
              <rect width={WORLD_W} height={WORLD_H} fill="rgba(0,0,0,0.52)" />
              <foreignObject x={WORLD_W / 2 - 145} y={WORLD_H / 2 - 50} width={290} height={100}
                onClick={(e) => e.stopPropagation()}>
                <div style={{ fontFamily: "system-ui", textAlign: "center", color: "white", padding: "14px" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Tower Defense</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Place towers · Press Space or Start Wave<br />
                    Reach wave 100 — if you dare.<br />
                    <span style={{ color: "#a3e635" }}>Laser tower unlocks at wave {LASER_UNLOCK_ROUND}!</span>
                  </div>
                </div>
              </foreignObject>
            </g>
          )}
        </svg>
      </div>
    </section>
  );
}
