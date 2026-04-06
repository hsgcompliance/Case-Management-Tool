"use client";

import React from "react";
import { useMe, useUpdateMe } from "@hooks/useUsers";
import { buildHighScoreUpdate, GAME_SCORE_KEYS, getGameHighScore } from "../highScores";
import { markGameActive, shouldHandleGlobalGameKey, usePauseOnHidden } from "../input";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SpaceInvadersGameProps = {
  embedded?: boolean;
  renderStyle?: "embedded" | "fullscreen";
};

type EnemyKind = "small" | "medium" | "large" | "boss";

interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  kind: EnemyKind;
  flashFrames: number; // white flash on hit
}

interface Bullet {
  id: number;
  x: number;
  y: number;
}

interface EnemyBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0–1 remaining
  decay: number;
  r: number;
  color: string;
}

interface Star {
  x: number;
  y: number;
  r: number;
  brightness: number; // 0–1
  speed: number;
}

interface GState {
  // Meta
  phase: "idle" | "playing" | "paused" | "dead";
  wave: number;
  score: number;
  frame: number;

  // Player
  px: number;  // center x
  py: number;  // center y
  pvx: number;
  pvy: number;
  lives: number;
  invincible: number; // frames of invincibility after hit

  // Entities
  enemies: Enemy[];
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  particles: Particle[];

  // Spawn / wave timing
  spawnTimer: number;
  waveTimer: number;        // frames since wave started
  waveEndGrace: number;     // frames to wait after last enemy dies
  spawnedThisWave: number;
  targetSpawns: number;

  // Fire cooldown
  fireCooldown: number;
  holdingFire: boolean;     // set from input each frame

  // Boss active
  bossAlive: boolean;

  // IDs
  nextId: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CW = 560;
const CH = 400;

// Player geometry
const P_W = 24;
const P_H = 32;
const P_SPEED = 3.2;
const P_ACCEL = 0.55;
const P_FRICTION = 0.82;
const BULLET_SPEED = 11;
const FIRE_INTERVAL = 9; // frames between shots when holding space

// Enemy sizes / speeds
const ENEMY_CONFIG: Record<EnemyKind, { r: number; baseHp: number; baseSpeed: number; scoreValue: number }> = {
  small:  { r: 9,  baseHp: 1, baseSpeed: 2.2, scoreValue: 10 },
  medium: { r: 14, baseHp: 3, baseSpeed: 1.4, scoreValue: 25 },
  large:  { r: 20, baseHp: 6, baseSpeed: 0.9, scoreValue: 50 },
  boss:   { r: 32, baseHp: 40, baseSpeed: 0.7, scoreValue: 300 },
};

// Enemy fill colors (by kind, and by hp fraction)
function enemyFill(kind: EnemyKind, hpFrac: number, flash: boolean): string {
  if (flash) return "#ffffff";
  if (kind === "boss") {
    // Boss pulses from dark red → vivid red
    const r = Math.round(180 + hpFrac * 60);
    return `rgb(${r},10,10)`;
  }
  // small=bright red, medium=mid red, large=dark red; all darken as hp drops
  const bases: Record<EnemyKind, [number, number, number]> = {
    small:  [239, 68,  68],
    medium: [185, 28,  28],
    large:  [127, 17,  17],
    boss:   [220, 10,  10],
  };
  const [br, bg, bb] = bases[kind];
  const fade = 0.55 + hpFrac * 0.45;
  return `rgb(${Math.round(br * fade)},${Math.round(bg * fade)},${Math.round(bb * fade)})`;
}

// Wave scaling
function waveHpScale(wave: number) {
  return 1 + wave * 0.18 + Math.pow(Math.max(0, wave - 3) / 8, 2) * 0.3;
}
function waveSpawnInterval(wave: number) {
  return Math.max(18, 110 - wave * 5.5);
}
function waveEnemyShootChance(wave: number) {
  // probability per enemy per 60 frames of shooting
  return Math.min(0.55, 0.05 + wave * 0.025);
}
// Boss appears every 10 waves
function isBossWave(wave: number) {
  return wave > 0 && wave % 10 === 0;
}

function enemyCountForWave(wave: number) {
  if (isBossWave(wave)) return 1;
  return Math.min(6 + wave * 2, 28);
}

// ─── Stars (pre-generated once) ──────────────────────────────────────────────

function makeStars(count: number): Star[] {
  const stars: Star[] = [];
  // use a deterministic LCG so it's the same every render
  let seed = 0xdeadbeef;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed >>> 0) / 0x100000000; };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng() * CW,
      y: rng() * CH,
      r: 0.5 + rng() * 1.2,
      brightness: 0.3 + rng() * 0.7,
      speed: 0.3 + rng() * 0.8,
    });
  }
  return stars;
}

const STARS = makeStars(80);

// ─── Initial state ────────────────────────────────────────────────────────────

function makeInitialState(): GState {
  return {
    phase: "idle",
    wave: 0,
    score: 0,
    frame: 0,
    px: CW / 2,
    py: CH - 60,
    pvx: 0,
    pvy: 0,
    lives: 3,
    invincible: 0,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    spawnTimer: 0,
    waveTimer: 0,
    waveEndGrace: 0,
    spawnedThisWave: 0,
    targetSpawns: 0,
    fireCooldown: 0,
    holdingFire: false,
    bossAlive: false,
    nextId: 1,
  };
}

// ─── Game logic ───────────────────────────────────────────────────────────────

interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  mx: number | null; // mouse x relative to canvas
  my: number | null;
  useMouse: boolean;
}

function spawnEnemy(g: GState): void {
  const wave = g.wave;
  const hpScale = waveHpScale(wave);
  const id = g.nextId++;

  // Boss wave: spawn one big boss
  if (isBossWave(wave) && !g.bossAlive && g.enemies.length === 0) {
    const cfg = ENEMY_CONFIG.boss;
    g.enemies.push({
      id, x: CW / 2, y: -cfg.r,
      vx: 0, vy: cfg.baseSpeed * 0.6,
      hp: Math.ceil(cfg.baseHp * hpScale),
      maxHp: Math.ceil(cfg.baseHp * hpScale),
      r: cfg.r, kind: "boss", flashFrames: 0,
    });
    g.bossAlive = true;
    g.spawnedThisWave++;
    return;
  }

  // Normal wave: pick kind weighted by wave
  let kinds: EnemyKind[];
  if (wave <= 2) {
    kinds = ["small", "small", "small", "medium"];
  } else if (wave <= 6) {
    kinds = ["small", "small", "medium", "medium", "large"];
  } else {
    kinds = ["small", "medium", "medium", "large", "large"];
  }
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const cfg = ENEMY_CONFIG[kind];

  const x = cfg.r + Math.random() * (CW - cfg.r * 2);
  // Random horizontal drift
  const vx = (Math.random() - 0.5) * cfg.baseSpeed * 1.2;
  const vy = cfg.baseSpeed * (0.8 + Math.random() * 0.4);

  g.enemies.push({
    id, x, y: -cfg.r,
    vx, vy,
    hp: Math.ceil(cfg.baseHp * hpScale),
    maxHp: Math.ceil(cfg.baseHp * hpScale),
    r: cfg.r, kind, flashFrames: 0,
  });
  g.spawnedThisWave++;
}

function spawnDeathParticles(g: GState, x: number, y: number, kind: EnemyKind): void {
  const colors = kind === "boss"
    ? ["#ef4444", "#dc2626", "#b91c1c", "#f97316", "#fbbf24"]
    : ["#ef4444", "#dc2626", "#b91c1c", "#f87171"];
  const count = kind === "boss" ? 24 : kind === "large" ? 14 : kind === "medium" ? 10 : 6;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const spd = 1.5 + Math.random() * 3.5;
    g.particles.push({
      id: g.nextId++,
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      decay: 0.03 + Math.random() * 0.04,
      r: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function spawnHitParticles(g: GState, x: number, y: number): void {
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    g.particles.push({
      id: g.nextId++,
      x, y,
      vx: Math.cos(angle) * (1 + Math.random() * 2),
      vy: Math.sin(angle) * (1 + Math.random() * 2),
      life: 1,
      decay: 0.07 + Math.random() * 0.08,
      r: 1.5 + Math.random() * 2,
      color: "#fbbf24",
    });
  }
}

function updateGame(g: GState, input: InputState): void {
  if (g.phase !== "playing") return;
  g.frame++;
  g.waveTimer++;

  // ── Player movement ───────────────────────────────────────────────────────
  if (input.useMouse && input.mx !== null && input.my !== null) {
    const dx = input.mx - g.px;
    const dy = input.my - g.py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 4) {
      const spd = Math.min(P_SPEED * 1.5, dist * 0.15);
      g.pvx += (dx / dist) * spd;
      g.pvy += (dy / dist) * spd;
    }
  } else {
    if (input.left)  g.pvx -= P_ACCEL;
    if (input.right) g.pvx += P_ACCEL;
    if (input.up)    g.pvy -= P_ACCEL;
    if (input.down)  g.pvy += P_ACCEL;
  }
  g.pvx *= P_FRICTION;
  g.pvy *= P_FRICTION;
  // clamp speed
  const spd = Math.sqrt(g.pvx * g.pvx + g.pvy * g.pvy);
  if (spd > P_SPEED) { g.pvx = (g.pvx / spd) * P_SPEED; g.pvy = (g.pvy / spd) * P_SPEED; }

  g.px += g.pvx;
  g.py += g.pvy;
  g.px = Math.max(P_W / 2, Math.min(CW - P_W / 2, g.px));
  g.py = Math.max(P_H / 2, Math.min(CH - P_H / 2, g.py));

  // ── Fire ─────────────────────────────────────────────────────────────────
  g.holdingFire = input.fire;
  if (g.fireCooldown > 0) g.fireCooldown--;
  if (input.fire && g.fireCooldown === 0) {
    // triple shot at higher waves
    const tripleShot = g.wave >= 5;
    g.bullets.push({ id: g.nextId++, x: g.px, y: g.py - P_H / 2 });
    if (tripleShot) {
      g.bullets.push({ id: g.nextId++, x: g.px - 8, y: g.py - P_H / 2 + 4 });
      g.bullets.push({ id: g.nextId++, x: g.px + 8, y: g.py - P_H / 2 + 4 });
    }
    g.fireCooldown = FIRE_INTERVAL;
  }

  // ── Move bullets ──────────────────────────────────────────────────────────
  g.bullets = g.bullets.filter(b => {
    b.y -= BULLET_SPEED;
    return b.y > -10;
  });

  // ── Move enemy bullets ────────────────────────────────────────────────────
  g.enemyBullets = g.enemyBullets.filter(eb => {
    eb.x += eb.vx;
    eb.y += eb.vy;
    return eb.y < CH + 10 && eb.x > -10 && eb.x < CW + 10;
  });

  // ── Spawn enemies ─────────────────────────────────────────────────────────
  if (g.wave > 0 && g.waveEndGrace === 0) {
    // Stop spawning once this wave has produced its full quota.
    const isBoss = isBossWave(g.wave);
    const canSpawn = g.spawnedThisWave < g.targetSpawns && (!isBoss || !g.bossAlive);
    if (canSpawn) {
      g.spawnTimer--;
      if (g.spawnTimer <= 0) {
        // Don't flood; cap active enemies
        const maxActive = Math.min(6 + g.wave, 20);
        if (g.enemies.length < maxActive) {
          spawnEnemy(g);
        }
        g.spawnTimer = waveSpawnInterval(g.wave);
      }
    }
  }

  // ── Move enemies ──────────────────────────────────────────────────────────
  const shootChancePerFrame = waveEnemyShootChance(g.wave) / 60;
  for (const e of g.enemies) {
    if (e.flashFrames > 0) e.flashFrames--;

    // Boss has a side-to-side sweep pattern
    if (e.kind === "boss") {
      e.x += e.vx;
      e.y += e.vy;
      // bounce horizontally
      if (e.x < e.r + 10 || e.x > CW - e.r - 10) e.vx *= -1;
      // stop descending after reaching y=80
      if (e.y > 80) e.vy = 0;
    } else {
      e.x += e.vx;
      e.y += e.vy;
      // bounce horizontally
      if (e.x < e.r || e.x > CW - e.r) e.vx *= -1;
    }

    // Enemy shooting
    if (Math.random() < shootChancePerFrame && e.y > 0) {
      const dx = g.px - e.x;
      const dy = g.py - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const bspd = e.kind === "boss" ? 3.5 : 2.2;
      g.enemyBullets.push({
        id: g.nextId++,
        x: e.x, y: e.y + e.r,
        vx: (dx / dist) * bspd,
        vy: (dy / dist) * bspd,
      });
    }
  }

  // Remove enemies that went off screen bottom
  g.enemies = g.enemies.filter(e => {
    if (e.y > CH + e.r) {
      if (e.kind === "boss") g.bossAlive = false;
      return false;
    }
    return true;
  });

  // ── Bullet ↔ enemy collisions ─────────────────────────────────────────────
  const deadBulletIds = new Set<number>();
  for (const e of g.enemies) {
    for (const b of g.bullets) {
      if (deadBulletIds.has(b.id)) continue;
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      if (dx * dx + dy * dy < (e.r + 3) * (e.r + 3)) {
        e.hp--;
        e.flashFrames = 4;
        deadBulletIds.add(b.id);
        spawnHitParticles(g, b.x, b.y);
        if (e.hp <= 0) {
          spawnDeathParticles(g, e.x, e.y, e.kind);
          g.score += ENEMY_CONFIG[e.kind].scoreValue * g.wave;
          if (e.kind === "boss") g.bossAlive = false;
        }
      }
    }
  }
  g.bullets = g.bullets.filter(b => !deadBulletIds.has(b.id));
  g.enemies = g.enemies.filter(e => e.hp > 0);

  // ── Enemy bullet ↔ player collision ──────────────────────────────────────
  if (g.invincible > 0) {
    g.invincible--;
  } else {
    const hitRadius = P_W / 2 - 2;
    for (const eb of g.enemyBullets) {
      const dx = eb.x - g.px;
      const dy = eb.y - g.py;
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        g.lives--;
        g.invincible = 90; // 1.5s invincibility
        g.enemyBullets = [];
        // Push player particles
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          g.particles.push({
            id: g.nextId++,
            x: g.px, y: g.py,
            vx: Math.cos(a) * (1.5 + Math.random() * 2),
            vy: Math.sin(a) * (1.5 + Math.random() * 2),
            life: 1, decay: 0.05, r: 2.5,
            color: "#60a5fa",
          });
        }
        if (g.lives <= 0) {
          g.phase = "dead";
          return;
        }
        break;
      }
    }
  }

  // ── Enemy ↔ player direct collision ──────────────────────────────────────
  if (g.invincible === 0) {
    for (const e of g.enemies) {
      const dx = e.x - g.px;
      const dy = e.y - g.py;
      if (dx * dx + dy * dy < (e.r + P_W / 2 - 4) * (e.r + P_W / 2 - 4)) {
        g.lives--;
        g.invincible = 90;
        g.enemies = g.enemies.filter(x => x.id !== e.id);
        if (e.kind === "boss") g.bossAlive = false;
        spawnDeathParticles(g, e.x, e.y, e.kind);
        if (g.lives <= 0) {
          g.phase = "dead";
          return;
        }
        break;
      }
    }
  }

  // ── Update particles ──────────────────────────────────────────────────────
  g.particles = g.particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= p.decay;
    return p.life > 0;
  });

  // ── Wave end check ────────────────────────────────────────────────────────
  if (
    g.wave > 0 &&
    g.waveEndGrace === 0 &&
    g.spawnedThisWave >= g.targetSpawns &&
    g.enemies.length === 0
  ) {
    // Give a brief grace period for last bullets to die
    g.waveEndGrace = 60;
  }
  if (g.waveEndGrace > 0) {
    g.waveEndGrace--;
    if (g.waveEndGrace === 0) {
      // Advance wave
      g.wave++;
      g.spawnTimer = 40;
      g.waveTimer = 0;
      g.bossAlive = false;
      g.spawnedThisWave = 0;
      g.targetSpawns = enemyCountForWave(g.wave);
    }
  }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

/** Draws a typed enemy ship sprite centered at (e.x, e.y), pointing downward. */
function drawEnemyShip(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const { x, y, r, kind, hp, maxHp, flashFrames } = e;
  const hpFrac = hp / maxHp;
  const flash = flashFrames > 0;
  const col = enemyFill(kind, hpFrac, flash);
  const darkCol = flash ? "#ffffff" : enemyFill(kind, Math.max(0, hpFrac - 0.3), false);

  // Glow halo
  if (!flash) {
    ctx.shadowColor = kind === "boss" ? "#ef444480" : "#dc262650";
    ctx.shadowBlur = r * 0.9;
  }

  ctx.save();
  ctx.translate(x, y);

  if (kind === "small") {
    // Dart: narrow pointed fuselage, swept mini-wings
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, r);              // nose → down
    ctx.lineTo(r * 0.38, -r * 0.25);
    ctx.lineTo(0, -r * 0.6);
    ctx.lineTo(-r * 0.38, -r * 0.25);
    ctx.closePath();
    ctx.fill();
    // Swept wings
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, r * 0.1);
    ctx.lineTo(-r * 0.95, r * 0.4);
    ctx.lineTo(-r * 0.3, -r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.35, r * 0.1);
    ctx.lineTo(r * 0.95, r * 0.4);
    ctx.lineTo(r * 0.3, -r * 0.15);
    ctx.closePath();
    ctx.fill();

  } else if (kind === "medium") {
    // Swept-wing interceptor
    ctx.fillStyle = col;
    // Fuselage
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.lineTo(r * 0.28, r * 0.05);
    ctx.lineTo(r * 0.22, -r * 0.78);
    ctx.lineTo(-r * 0.22, -r * 0.78);
    ctx.lineTo(-r * 0.28, r * 0.05);
    ctx.closePath();
    ctx.fill();
    // Swept wings
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.moveTo(-r * 0.26, r * 0.05);
    ctx.lineTo(-r * 0.88, r * 0.55);
    ctx.lineTo(-r * 0.6, -r * 0.28);
    ctx.lineTo(-r * 0.26, -r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.26, r * 0.05);
    ctx.lineTo(r * 0.88, r * 0.55);
    ctx.lineTo(r * 0.6, -r * 0.28);
    ctx.lineTo(r * 0.26, -r * 0.1);
    ctx.closePath();
    ctx.fill();
    // Cockpit
    ctx.fillStyle = flash ? "#fff" : "rgba(255,100,100,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 0.11, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();

  } else if (kind === "large") {
    // Heavy bomber: wide body, engine pods on wings
    ctx.fillStyle = col;
    // Fuselage
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.lineTo(r * 0.38, r * 0.3);
    ctx.lineTo(r * 0.35, -r * 0.68);
    ctx.lineTo(-r * 0.35, -r * 0.68);
    ctx.lineTo(-r * 0.38, r * 0.3);
    ctx.closePath();
    ctx.fill();
    // Wide wings
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.moveTo(-r * 0.36, r * 0.12);
    ctx.lineTo(-r * 0.95, r * 0.52);
    ctx.lineTo(-r * 0.85, -r * 0.08);
    ctx.lineTo(-r * 0.36, -r * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.36, r * 0.12);
    ctx.lineTo(r * 0.95, r * 0.52);
    ctx.lineTo(r * 0.85, -r * 0.08);
    ctx.lineTo(r * 0.36, -r * 0.18);
    ctx.closePath();
    ctx.fill();
    // Engine pods
    ctx.fillStyle = flash ? "#fff" : "#7f1d1d";
    ctx.beginPath();
    ctx.ellipse(-r * 0.6, r * 0.22, r * 0.12, r * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.6, r * 0.22, r * 0.12, r * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cockpit
    ctx.fillStyle = flash ? "#fff" : "rgba(255,80,80,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.28, r * 0.13, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // Boss: dreadnought — layered hull + broad wings + gun mounts
    ctx.fillStyle = col;
    // Main hull
    ctx.beginPath();
    ctx.moveTo(0, r * 0.95);
    ctx.lineTo(r * 0.3, r * 0.5);
    ctx.lineTo(r * 0.37, -r * 0.15);
    ctx.lineTo(r * 0.26, -r * 0.82);
    ctx.lineTo(-r * 0.26, -r * 0.82);
    ctx.lineTo(-r * 0.37, -r * 0.15);
    ctx.lineTo(-r * 0.3, r * 0.5);
    ctx.closePath();
    ctx.fill();
    // Outer swept wings
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.moveTo(-r * 0.33, r * 0.25);
    ctx.lineTo(-r * 0.97, r * 0.62);
    ctx.lineTo(-r * 0.92, r * 0.08);
    ctx.lineTo(-r * 0.52, -r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.33, r * 0.25);
    ctx.lineTo(r * 0.97, r * 0.62);
    ctx.lineTo(r * 0.92, r * 0.08);
    ctx.lineTo(r * 0.52, -r * 0.12);
    ctx.closePath();
    ctx.fill();
    // Inner wing struts
    ctx.fillStyle = flash ? "#fff" : enemyFill(kind, hpFrac * 0.45, false);
    ctx.beginPath();
    ctx.moveTo(-r * 0.33, r * 0.05);
    ctx.lineTo(-r * 0.62, r * 0.32);
    ctx.lineTo(-r * 0.58, -r * 0.08);
    ctx.lineTo(-r * 0.36, -r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.33, r * 0.05);
    ctx.lineTo(r * 0.62, r * 0.32);
    ctx.lineTo(r * 0.58, -r * 0.08);
    ctx.lineTo(r * 0.36, -r * 0.1);
    ctx.closePath();
    ctx.fill();
    // Gun mounts (side cannons)
    ctx.fillStyle = flash ? "#fff" : "#450a0a";
    ctx.fillRect(-r * 0.75, r * 0.28, r * 0.14, r * 0.32);
    ctx.fillRect(r * 0.61, r * 0.28, r * 0.14, r * 0.32);
    // Cockpit
    ctx.fillStyle = flash ? "#fff" : "rgba(255,60,60,0.55)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.28, r * 0.15, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crosshair detail
    if (!flash) {
      ctx.strokeStyle = "rgba(255,100,100,0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, 0);
      ctx.lineTo(r * 0.22, 0);
      ctx.moveTo(0, -r * 0.28);
      ctx.lineTo(0, r * 0.28);
      ctx.stroke();
    }
  }

  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  // HP bar for medium, large, boss
  if (kind !== "small" && hpFrac < 1 && !flash) {
    const barW = r * 2;
    const barH = kind === "boss" ? 4 : 3;
    const bx = x - barW / 2;
    const by = y + r + 5;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = hpFrac > 0.5 ? "#22c55e" : hpFrac > 0.25 ? "#eab308" : "#ef4444";
    ctx.fillRect(bx, by, barW * hpFrac, barH);
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, g: GState, stars: Star[], starOffset: number): void {
  // Background
  ctx.fillStyle = "#05050f";
  ctx.fillRect(0, 0, CW, CH);

  // Stars (scrolling)
  for (const s of stars) {
    const y = ((s.y + starOffset * s.speed) % CH + CH) % CH;
    ctx.globalAlpha = s.brightness;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (g.phase === "idle") {
    drawOverlay(ctx, "1945", ["Click or press Space to start"], "#ffffff", "#60a5fa");
    return;
  }

  // Particles
  for (const p of g.particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Enemy bullets
  ctx.fillStyle = "#f97316";
  for (const eb of g.enemyBullets) {
    ctx.beginPath();
    ctx.arc(eb.x, eb.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player bullets
  ctx.fillStyle = "#fde68a";
  for (const b of g.bullets) {
    ctx.fillRect(b.x - 2, b.y - 7, 4, 14);
  }

  // Enemies — drawn as typed ship sprites
  for (const e of g.enemies) {
    drawEnemyShip(ctx, e);
  }

  // Player
  if (g.phase === "playing") {
    const flicker = g.invincible > 0 && Math.floor(g.frame / 5) % 2 === 0;
    if (!flicker) {
      drawPlayer(ctx, g.px, g.py);
    }
  }

  // HUD
  drawHud(ctx, g);

  if (g.phase === "paused") {
    drawOverlay(ctx, "PAUSED", ["Press P to resume"], "#ffffff", "#94a3b8");
  }
  if (g.phase === "dead") {
    drawOverlay(ctx, "GAME OVER", [`Wave ${g.wave}  •  Score ${g.score.toLocaleString()}`, "Click or Space to try again"], "#ef4444", "#fca5a5");
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Blue fighter plane shape
  ctx.shadowColor = "#60a5fa60";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#3b82f6";

  // Fuselage
  ctx.beginPath();
  ctx.moveTo(cx, cy - P_H / 2);          // nose
  ctx.lineTo(cx + 5, cy - 2);
  ctx.lineTo(cx + 4, cy + P_H / 2 - 4);
  ctx.lineTo(cx - 4, cy + P_H / 2 - 4);
  ctx.lineTo(cx - 5, cy - 2);
  ctx.closePath();
  ctx.fill();

  // Wings
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy);
  ctx.lineTo(cx - P_W / 2, cy + 10);
  ctx.lineTo(cx - 4, cy + 4);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 5, cy);
  ctx.lineTo(cx + P_W / 2, cy + 10);
  ctx.lineTo(cx + 4, cy + 4);
  ctx.closePath();
  ctx.fill();

  // Cockpit window
  ctx.fillStyle = "#93c5fd";
  ctx.beginPath();
  ctx.ellipse(cx, cy - 6, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Engine glow
  ctx.shadowColor = "#f97316";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#fdba74";
  ctx.fillRect(cx - 3, cy + P_H / 2 - 4, 6, 4);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

function drawHud(ctx: CanvasRenderingContext2D, g: GState): void {
  ctx.font = "bold 13px monospace";
  ctx.textBaseline = "top";

  // Wave
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("WAVE", 12, 10);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 20px monospace";
  ctx.fillText(String(g.wave), 12, 24);

  // Score
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("SCORE", CW / 2 - 30, 10);
  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 16px monospace";
  const scoreStr = g.score.toLocaleString();
  ctx.fillText(scoreStr, CW / 2 - ctx.measureText(scoreStr).width / 2, 26);

  // Lives
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("LIVES", CW - 70, 10);
  for (let i = 0; i < g.lives; i++) {
    // Small plane icon
    const lx = CW - 65 + i * 18;
    const ly = 28;
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(lx + 4, ly);
    ctx.lineTo(lx + 6, ly + 5);
    ctx.lineTo(lx + 2, ly + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.moveTo(lx + 2, ly + 2);
    ctx.lineTo(lx, ly + 5);
    ctx.lineTo(lx + 3, ly + 3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(lx + 6, ly + 2);
    ctx.lineTo(lx + 8, ly + 5);
    ctx.lineTo(lx + 5, ly + 3);
    ctx.closePath();
    ctx.fill();
  }

  // Wave transition banner
  if (g.waveEndGrace > 30 && g.waveEndGrace < 60) {
    const alpha = Math.min(1, (60 - g.waveEndGrace) / 10);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 22px monospace";
    const msg = `Wave ${g.wave} cleared!`;
    ctx.fillText(msg, CW / 2 - ctx.measureText(msg).width / 2, CH / 2 - 14);
    ctx.globalAlpha = 1;
  }
  if (g.waveEndGrace > 0 && g.waveEndGrace <= 30) {
    const alpha = g.waveEndGrace / 30;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 22px monospace";
    const msg = `Wave ${g.wave} cleared!`;
    ctx.fillText(msg, CW / 2 - ctx.measureText(msg).width / 2, CH / 2 - 14);
    ctx.globalAlpha = 1;
  }
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  title: string,
  lines: string[],
  titleColor: string,
  subtitleColor: string,
): void {
  ctx.fillStyle = "rgba(5,5,15,0.72)";
  ctx.fillRect(0, 0, CW, CH);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 36px monospace";
  ctx.fillStyle = titleColor;
  ctx.fillText(title, CW / 2, CH / 2 - 30 - (lines.length - 1) * 14);

  ctx.font = "14px monospace";
  ctx.fillStyle = subtitleColor;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], CW / 2, CH / 2 + 10 + i * 24);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpaceInvadersGame(_props: SpaceInvadersGameProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const gRef = React.useRef<GState>(makeInitialState());
  const inputRef = React.useRef<InputState>({
    left: false, right: false, up: false, down: false, fire: false,
    mx: null, my: null, useMouse: false,
  });
  const starOffsetRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const [overlay, setOverlay] = React.useState<"idle" | "playing" | "paused" | "dead">("idle");
  const [highScore, setHighScore] = React.useState(0);

  const meQ = useMe();
  const updateMe = useUpdateMe();

  React.useEffect(() => {
    if (!meQ.data) return;
    const hs = getGameHighScore(meQ.data, GAME_SCORE_KEYS.spaceInvaders);
    setHighScore(hs);
  }, [meQ.data]);

  // Save high score
  const maybeSaveScore = React.useCallback((wave: number, score: number) => {
    if (!meQ.data) return;
    // Save wave as the score key (higher wave = better) but also track raw score
    const update = buildHighScoreUpdate(meQ.data, GAME_SCORE_KEYS.spaceInvaders, wave);
    if (update) {
      updateMe.mutate({ extras: update });
      setHighScore(wave);
    }
    // suppress unused var
    void score;
  }, [meQ.data, updateMe]);

  // RAF loop
  const loop = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const g = gRef.current;
    const input = inputRef.current;

    starOffsetRef.current = (starOffsetRef.current + 0.6) % CH;
    updateGame(g, input);
    drawFrame(ctx, g, STARS, starOffsetRef.current);

    // Sync overlay state only on transitions
    if (g.phase !== overlay) {
      setOverlay(g.phase);
      if (g.phase === "dead") {
        maybeSaveScore(g.wave, g.score);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [overlay, maybeSaveScore]);

  // Start/stop RAF
  React.useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  // Keyboard
  React.useEffect(() => {
    const root = wrapperRef.current;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (!shouldHandleGlobalGameKey(root, e)) return;
      const g = gRef.current;
      const input = inputRef.current;

      switch (e.code) {
        case "ArrowLeft":  case "KeyA": input.left  = down; input.useMouse = false; e.preventDefault(); break;
        case "ArrowRight": case "KeyD": input.right = down; input.useMouse = false; e.preventDefault(); break;
        case "ArrowUp":    case "KeyW": input.up    = down; input.useMouse = false; e.preventDefault(); break;
        case "ArrowDown":  case "KeyS": input.down  = down; input.useMouse = false; e.preventDefault(); break;
        case "Space":
          e.preventDefault();
          if (down) {
            if (g.phase === "idle" || g.phase === "dead") {
              startGame(g);
            } else if (g.phase === "playing" || g.phase === "paused") {
              input.fire = true;
            }
          } else {
            input.fire = false;
          }
          break;
        case "KeyP":
          if (down) {
            if (g.phase === "playing") g.phase = "paused";
            else if (g.phase === "paused") g.phase = "playing";
          }
          break;
      }
    };

    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  // Mouse
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = () => canvas.getBoundingClientRect();
    const toCanvas = (clientX: number, clientY: number) => {
      const r = rect();
      const scaleX = CW / r.width;
      const scaleY = CH / r.height;
      return { x: (clientX - r.left) * scaleX, y: (clientY - r.top) * scaleY };
    };

    const onMove = (e: MouseEvent) => {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      inputRef.current.mx = x;
      inputRef.current.my = y;
      inputRef.current.useMouse = true;
      markGameActive(canvas);
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const g = gRef.current;
      if (g.phase === "idle" || g.phase === "dead") {
        startGame(g);
      } else {
        inputRef.current.fire = true;
      }
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) inputRef.current.fire = false;
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Touch
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const toCanvas = (t: Touch) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (t.clientX - r.left) * (CW / r.width),
        y: (t.clientY - r.top) * (CH / r.height),
      };
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const { x, y } = toCanvas(e.touches[0]);
      inputRef.current.mx = x;
      inputRef.current.my = y;
      inputRef.current.useMouse = true;
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const g = gRef.current;
      if (g.phase === "idle" || g.phase === "dead") startGame(g);
      else inputRef.current.fire = true;
    };
    const onTouchEnd = () => { inputRef.current.fire = false; };
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    return () => {
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  usePauseOnHidden(React.useCallback(() => {
    if (gRef.current.phase === "playing") gRef.current.phase = "paused";
  }, []));

  return (
    <div
      ref={wrapperRef}
      data-game-instance="space-invaders"
      className="flex w-full flex-col items-center gap-2 select-none"
      onMouseEnter={() => { if (wrapperRef.current) markGameActive(wrapperRef.current); }}
    >
      {/* High score bar */}
      <div className="flex w-full max-w-[560px] items-center justify-between px-1 text-xs text-slate-500">
        <span>✈️ 1945</span>
        {highScore > 0 && <span className="text-violet-400">Best wave: {highScore}</span>}
      </div>

      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="w-full max-w-[560px] cursor-crosshair rounded-lg border border-slate-800 bg-[#05050f]"
        style={{ aspectRatio: `${CW}/${CH}`, imageRendering: "pixelated" }}
      />

      <p className="text-xs text-slate-600">
        Move: arrows / mouse &nbsp;•&nbsp; Shoot: hold Space / click &nbsp;•&nbsp; Pause: P
      </p>
    </div>
  );
}

// ─── Helpers (module-level, not inside component) ─────────────────────────────

function startGame(g: GState): void {
  const fresh = makeInitialState();
  Object.assign(g, fresh);
  g.phase = "playing";
  g.wave = 1;
  g.spawnTimer = 40;
  g.waveTimer = 0;
  g.spawnedThisWave = 0;
  g.targetSpawns = enemyCountForWave(g.wave);
  g.bossAlive = false;
}
