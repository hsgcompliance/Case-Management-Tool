// web/src/features/games/necromancer/NecromancerEngine.ts
// Top-down battlefield rules for the customer-overlay necromancer game.
//
// This file intentionally stays DOM-free so the game can mount over the live
// customer page without mutating customer cards or depending on live DOM nodes
// after the initial snapshot. The renderer feeds in a one-time list of customer
// positions, and everything after that is simulated in lightweight plain data.
//
// Design goals of this rewrite:
// - Replace the previous 1-D lane logic with a 2-D top-down battlefield.
// - Keep control readable: selection, movement, targeting, revives, upgrades.
// - Keep unit behavior autonomous so the player directs intent, not every swing.
// - Preserve the "perfect mount" architecture: no page reflow, no DOM disruption.

import { getEnemySpec, type EnemyVariant } from "./enemies/catalog";
import { buildEnemyWave } from "./enemies/strategies";
import type { EffectKind, ProjectileKind } from "./visuals";

let nextUidValue = 0;

function nextUid(): number {
  nextUidValue += 1;
  return nextUidValue;
}

function randomUnit(): number {
  return Math.random();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(px, py, ax, ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  const projX = ax + dx * t;
  const projY = ay + dy * t;
  return distance(px, py, projX, projY);
}

function normalize(dx: number, dy: number): { x: number; y: number; length: number } {
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length, length };
}

export type UpgradePath = "warrior" | "guardian" | "ranger";
export type UpgradeBranch = "primary" | "secondary" | "special";
export type GamePhase = "intro" | "planning" | "playing" | "victory" | "defeat";

export interface NecromancerCustomer {
  id: string;
  name: string;
  isActive: boolean;
  cardX: number;
  cardY: number;
}

export interface BattlefieldBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface Soldier {
  uid: number;
  customerId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attackCooldownLeft: number;
  dead: boolean;
  deathTimer: number;
  facingX: number;
  facingY: number;
  moveTargetX: number | null;
  moveTargetY: number | null;
  targetEnemyUid: number | null;
  mountedStructureUid: number | null;
  path: UpgradePath | null;
  level: number;
  experience: number;
  pathLevel: number;
  upgradeLevels: Record<UpgradeBranch, number>;
  tauntCooldownLeft: number;
  tauntActiveTimer: number;
  chargeCooldownLeft: number;
  dodgeCooldownLeft: number;
  hitFlash: number;
  /** Counts down from RISE_DURATION on spawn/revive; drives the rise-up animation. */
  riseTimer: number;
  /** Radians; increments while alive for the subtle bob oscillation. */
  bobPhase: number;
}

export interface Enemy {
  uid: number;
  variant: EnemyVariant;
  name: string;
  powerLevel: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attackCooldownLeft: number;
  dead: boolean;
  deathTimer: number;
  spawnFromX: number;
  spawnFromY: number;
  targetSoldierUid: number | null;
  hitFlash: number;
  damageContributors: Record<number, number>;
}

export type BuildableKind = "wall" | "tower" | "spikeTrap" | "blastTrap";

export interface Structure {
  uid: number;
  kind: BuildableKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  rotation: number;
  dead: boolean;
  deathTimer: number;
  ownerSoldierUid: number | null;
  charges: number;
}

export interface SpawnOrder {
  uid: number;
  variant: EnemyVariant;
  x: number;
  y: number;
  delay: number;
}

export interface LightningStrikeEffect {
  x: number;
  y: number;
  timer: number;
  radius: number;
}

export interface CombatProjectile {
  uid: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
  maxTimer: number;
  radius: number;
}

export interface CombatEffect {
  uid: number;
  kind: EffectKind;
  x: number;
  y: number;
  timer: number;
  maxTimer: number;
  radius: number;
  color: string;
}

export interface UpgradeAction {
  kind: "choose-path" | "upgrade-branch";
  soldierUid: number;
  path?: UpgradePath;
  branch?: UpgradeBranch;
}

export interface EffectiveStats {
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  preferredDistance: number;
  leashRadius: number;
  defenseMultiplier: number;
  swiftEscapeDistance: number;
  swiftEscapeSpeedMultiplier: number;
  tauntCooldown: number;
  tauntDuration: number;
  tauntRadius: number;
  chargeCooldown: number;
  chargeRange: number;
  chargeWidth: number;
  chargeDamageMultiplier: number;
  comboChance: number;
  comboMultiplier: number;
  critChance: number;
  critMultiplier: number;
}

export interface WaveDefinition {
  wave: number;
  label: string;
  spawnOrders: SpawnOrder[];
  reviveReward: number;
}

export interface NecromancerState {
  W: number;
  H: number;
  bounds: BattlefieldBounds;
  phase: GamePhase;
  phaseTimer: number;
  wave: number;
  totalWaves: number;
  score: number;
  gold: number;
  reviveCharges: number;
  smiteCooldownLeft: number;
  paused: boolean;
  timeScale: number;
  soldiers: Soldier[];
  enemies: Enemy[];
  structures: Structure[];
  spawnQueue: SpawnOrder[];
  waveLabel: string;
  t: number;
  lightningStrikes: LightningStrikeEffect[];
  projectiles: CombatProjectile[];
  effects: CombatEffect[];
  pendingMoveCommands: Array<{ soldierUids: number[]; x: number; y: number }>;
  pendingTargetCommands: Array<{ soldierUids: number[]; enemyUid: number }>;
  pendingClearTargetCommands: Array<{ soldierUids: number[] }>;
  pendingReviveCommands: Array<{ soldierUid: number }>;
  pendingSmiteCommands: Array<{ x: number; y: number }>;
  pendingBuildCommands: Array<{ kind: BuildableKind; x: number; y: number; rotation: number }>;
  pendingTowerMountCommands: Array<{ soldierUid: number; structureUid: number }>;
  pendingUpgradeCommands: UpgradeAction[];
}

const MIN_SOLDIERS = 5;
const MAX_SOLDIERS = 8;
const GHOST_REVIVE_WINDOW_SECONDS = 18;
const HEAL_ON_KILL_CHANCE = 0.28;
const HEAL_ON_KILL_RATIO = 0.22;
export const SMITE_COOLDOWN_SECONDS = 8;
const SMITE_RADIUS = 92;
const SMITE_DAMAGE = 78;
const SMITE_EFFECT_DURATION = 0.3;
const LOCAL_GROUP_RADIUS = 170;
const ORDER_GROUP_RADIUS = 68;
const RANGER_SUPPORT_OFFSET = 58;
const GUARDIAN_TAUNT_RADIUS = 150;
const GUARDIAN_TAUNT_WEIGHT = 70;
const CLASS_CHOICE_COST = 30;
const BRANCH_LEVEL_COSTS = [22, 36, 54, 76] as const;
const MAX_BRANCH_LEVEL = BRANCH_LEVEL_COSTS.length;
const KILL_XP = 16;
const ASSIST_XP = 9;
const LEVEL_HP_GAIN = 14;
const STRUCTURE_DECAY_SECONDS = 0.7;
const TOWER_GARRISON_RANGE_MULTIPLIER = 2;
const STRUCTURE_TARGET_RADIUS = 92;

const BUILDABLE_COSTS: Record<BuildableKind, { base: number; step: number }> = {
  wall: { base: 18, step: 6 },
  tower: { base: 48, step: 18 },
  spikeTrap: { base: 14, step: 5 },
  blastTrap: { base: 22, step: 7 },
};

const BUILDABLE_STATS: Record<BuildableKind, { hp: number; radius: number; charges: number }> = {
  wall: { hp: 160, radius: 90, charges: 0 },
  tower: { hp: 135, radius: 16, charges: 0 },
  spikeTrap: { hp: 1, radius: 16, charges: 1 },
  blastTrap: { hp: 1, radius: 18, charges: 1 },
};
// Rise-up animation duration when a soldier first spawns or is revived.
export const RISE_DURATION = 1.4;
// Bob oscillation speed (radians/second). One full bob ≈ 1.1 s.
const BOB_SPEED = 5.5;

export const PATH_LEVEL_COSTS = BRANCH_LEVEL_COSTS;

export const PATH_DEFS: Record<
  UpgradePath,
  {
    label: string;
    color: string;
    description: string;
    upgrades: Record<UpgradeBranch, { label: string; hint: string }>;
  }
> = {
  warrior: {
    label: "Warrior",
    color: "#fb923c",
    description: "Frontline bruiser that anchors space and chases priority kills.",
    upgrades: {
      primary: { label: "Attack", hint: "Harder melee swings and stronger charge damage." },
      secondary: { label: "Speed", hint: "Faster movement and attack rhythm." },
      special: { label: "Charge", hint: "Runs through clustered enemies for multiplied damage." },
    },
  },
  guardian: {
    label: "Guardian",
    color: "#60a5fa",
    description: "Tank who protects formation and holds the center.",
    upgrades: {
      primary: { label: "Defense", hint: "More mitigation and thicker frontline presence." },
      secondary: { label: "Power", hint: "Heavier tank swings without giving up control." },
      special: { label: "Taunt", hint: "Pulse a taunt that drags idle enemies onto the tank." },
    },
  },
  ranger: {
    label: "Ranger",
    color: "#4ade80",
    description: "Skirmisher that kites, keeps spacing, and cleans up edges.",
    upgrades: {
      primary: { label: "Range", hint: "Longer firing distance and safer spacing." },
      secondary: { label: "Power", hint: "Higher ranged damage and better cleanup." },
      special: { label: "Swift Escape", hint: "Sharper kiting bursts and faster retreat angles." },
    },
  },
};

const FALLBACK_NAMES = [
  "Aldric",
  "Brenna",
  "Cedric",
  "Daria",
  "Elric",
  "Faolan",
  "Gareth",
  "Helena",
  "Iris",
  "Jareth",
];

export function effectiveStats(soldier: Soldier): EffectiveStats {
  const primary = soldier.upgradeLevels.primary;
  const secondary = soldier.upgradeLevels.secondary;
  const special = soldier.upgradeLevels.special;
  const totalUpgrades = soldier.pathLevel;
  const stats: EffectiveStats = {
    maxHp: 110 + Math.max(0, soldier.level - 1) * LEVEL_HP_GAIN,
    moveSpeed: 98,
    attackDamage: 17,
    attackRange: 26,
    attackCooldown: 1.0,
    preferredDistance: 18,
    leashRadius: 140,
    defenseMultiplier: 1,
    swiftEscapeDistance: 80,
    swiftEscapeSpeedMultiplier: 0.92,
    tauntCooldown: 999,
    tauntDuration: 0,
    tauntRadius: GUARDIAN_TAUNT_RADIUS,
    chargeCooldown: 999,
    chargeRange: 0,
    chargeWidth: 0,
    chargeDamageMultiplier: 1,
    comboChance: 0,
    comboMultiplier: 0.6,
    critChance: 0,
    critMultiplier: 1.65,
  };

  if (soldier.path === "warrior") {
    stats.maxHp += 28;
    stats.attackDamage = 22 + primary * 5;
    stats.moveSpeed = 102 + secondary * 6;
    stats.attackCooldown = Math.max(0.6, 0.98 - secondary * 0.04);
    stats.leashRadius = 185 + secondary * 8;
    stats.chargeCooldown = Math.max(5.5, 10 - special * 1.1);
    stats.chargeRange = 112 + special * 18;
    stats.chargeWidth = 26 + special * 3;
    stats.chargeDamageMultiplier = 1.3 + special * 0.22;
    if (totalUpgrades >= 5) {
      stats.comboChance = 0.18 + secondary * 0.03;
      stats.critChance = 0.14 + primary * 0.03;
    }
  } else if (soldier.path === "guardian") {
    stats.maxHp += 62 + primary * 20;
    stats.attackDamage = 14 + secondary * 4;
    stats.moveSpeed = Math.max(58, 76 - primary * 2 - special);
    stats.attackCooldown = Math.max(0.72, 1.02 - secondary * 0.03);
    stats.leashRadius = 165 + primary * 10;
    stats.defenseMultiplier = Math.max(0.48, 0.82 - primary * 0.08);
    stats.tauntCooldown = Math.max(4.5, 10 - special * 1.15);
    stats.tauntDuration = special > 0 ? 1.8 + special * 0.45 : 0;
    stats.tauntRadius = GUARDIAN_TAUNT_RADIUS + special * 18;
  } else if (soldier.path === "ranger") {
    stats.maxHp -= 10;
    stats.attackDamage = 18 + secondary * 4;
    stats.attackCooldown = Math.max(0.52, 0.92 - secondary * 0.04);
    stats.attackRange = 104 + primary * 22;
    stats.preferredDistance = 82 + primary * 16;
    stats.moveSpeed = 116 + special * 3;
    stats.leashRadius = 205 + primary * 8 + special * 10;
    stats.swiftEscapeDistance = 84 + special * 16;
    stats.swiftEscapeSpeedMultiplier = 0.98 + special * 0.08;
  }

  if (soldier.mountedStructureUid !== null && soldier.path === "ranger") {
    stats.attackRange *= TOWER_GARRISON_RANGE_MULTIPLIER;
    stats.preferredDistance = Math.max(stats.preferredDistance, stats.attackRange * 0.72);
  }

  return stats;
}

function createBounds(W: number, H: number, customers?: NecromancerCustomer[]): BattlefieldBounds {
  // If we have customer positions, bound the field to the card area with padding.
  if (customers && customers.length > 0) {
    const xs = customers.map((c) => c.cardX);
    const ys = customers.map((c) => c.cardY);
    const pad = 80;
    const left = clamp(Math.min(...xs) - pad, 0, W);
    const top = clamp(Math.min(...ys) - pad, 0, H);
    const right = clamp(Math.max(...xs) + pad, 0, W);
    const bottom = clamp(Math.max(...ys) + pad, 0, H);
    // Ensure minimum playable area
    if (right - left > 200 && bottom - top > 200) {
      return { left, top, right, bottom, width: right - left, height: bottom - top, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
    }
  }
  const marginX = Math.max(80, Math.round(W * 0.08));
  const marginY = Math.max(90, Math.round(H * 0.1));
  const left = marginX;
  const top = marginY;
  const right = W - marginX;
  const bottom = H - marginY;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

function buildSoldierFormationPositions(bounds: BattlefieldBounds, count: number): Array<{ x: number; y: number }> {
  const columns = Math.min(3, Math.max(2, Math.ceil(count / 2)));
  const rows = Math.max(2, Math.ceil(count / columns));
  const spacingX = 72;
  const spacingY = 66;
  const startX = bounds.centerX - ((columns - 1) * spacingX) / 2;
  const startY = bounds.centerY + 40 - ((rows - 1) * spacingY) / 2;
  const positions: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions.push({
      x: clamp(startX + column * spacingX, bounds.left + 40, bounds.right - 40),
      y: clamp(startY + row * spacingY, bounds.top + 40, bounds.bottom - 40),
    });
  }

  return positions;
}

function createSoldier(
  customer: NecromancerCustomer | null,
  fallbackName: string,
  x: number,
  y: number,
): Soldier {
  const soldier: Soldier = {
    uid: nextUid(),
    customerId: customer?.id || `fallback-${nextUid()}`,
    name: (customer?.name || fallbackName || "Soldier").slice(0, 16),
    x,
    y,
    hp: 110,
    maxHp: 110,
    attackCooldownLeft: randomUnit() * 0.5,
    dead: false,
    deathTimer: 0,
    facingX: 0,
    facingY: -1,
    moveTargetX: null,
    moveTargetY: null,
    targetEnemyUid: null,
    mountedStructureUid: null,
    path: null,
    level: 1,
    experience: 0,
    pathLevel: 0,
    upgradeLevels: { primary: 0, secondary: 0, special: 0 },
    tauntCooldownLeft: 0,
    tauntActiveTimer: 0,
    chargeCooldownLeft: 0,
    dodgeCooldownLeft: 0,
    hitFlash: 0,
    riseTimer: RISE_DURATION,
    bobPhase: randomUnit() * Math.PI * 2,  // random start so soldiers don't all bob in sync
  };
  return soldier;
}

export function upgradeCost(action: UpgradeAction, soldier: Soldier): number {
  if (action.kind === "choose-path") return soldier.path === null ? CLASS_CHOICE_COST : Infinity;
  if (action.kind === "upgrade-branch") {
    if (!soldier.path || !action.branch) return Infinity;
    const currentLevel = soldier.upgradeLevels[action.branch];
    return currentLevel < MAX_BRANCH_LEVEL ? BRANCH_LEVEL_COSTS[currentLevel] : Infinity;
  }
  return Infinity;
}

export function buildCost(state: NecromancerState, kind: BuildableKind): number {
  const builtCount = state.structures.filter((structure) => structure.kind === kind && !structure.dead).length;
  const pricing = BUILDABLE_COSTS[kind];
  return pricing.base + builtCount * pricing.step;
}

export function initNecromancer(customers: NecromancerCustomer[], W: number, H: number): NecromancerState {
  const bounds = createBounds(W, H, customers);
  const activeCustomers = customers.filter((customer) => customer.isActive).slice(0, MAX_SOLDIERS);
  const formation = buildSoldierFormationPositions(bounds, Math.max(MIN_SOLDIERS, activeCustomers.length));
  const soldiers: Soldier[] = [];

  for (let index = 0; index < formation.length; index += 1) {
    soldiers.push(
      createSoldier(
        activeCustomers[index] || null,
        FALLBACK_NAMES[index % FALLBACK_NAMES.length],
        formation[index].x,
        formation[index].y,
      ),
    );
  }

  return {
    W,
    H,
    bounds,
    phase: "intro",
    phaseTimer: 1.5,
    wave: 0,
    totalWaves: Number.POSITIVE_INFINITY,
    score: 0,
    gold: 24,
    reviveCharges: 1,
    smiteCooldownLeft: 0,
    paused: false,
    timeScale: 1,
    soldiers,
    enemies: [],
    structures: [],
    spawnQueue: [],
    waveLabel: "Assemble the line",
    t: 0,
    lightningStrikes: [],
    projectiles: [],
    effects: [],
    pendingMoveCommands: [],
    pendingTargetCommands: [],
    pendingClearTargetCommands: [],
    pendingReviveCommands: [],
    pendingSmiteCommands: [],
    pendingBuildCommands: [],
    pendingTowerMountCommands: [],
    pendingUpgradeCommands: [],
  };
}

export function startNextWave(state: NecromancerState): void {
  if (state.phase !== "planning" && state.phase !== "intro") return;
  const nextWave = state.wave + 1;
  const definition = buildEnemyWave(state.bounds, nextWave, nextUid);
  state.wave = nextWave;
  state.waveLabel = definition.label;
  state.spawnQueue = [...definition.spawnOrders];
  state.phase = "playing";
  state.phaseTimer = 0;
}

export function togglePause(state: NecromancerState): void {
  state.paused = !state.paused;
}

export function setTimeScale(state: NecromancerState, scale: number): void {
  state.timeScale = scale;
}

export function tickNecromancer(state: NecromancerState, dt: number): void {
  if (state.paused) return;
  const scaledDt = dt * state.timeScale;
  // eslint-disable-next-line no-param-reassign
  dt = scaledDt;
  state.t += dt;
  processCommandQueue(state);

  if (state.phase === "intro") {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phase = "planning";
      state.waveLabel = "Plan the opening move";
    }
    return;
  }

  if (state.phase === "planning") {
    tickAnimations(state, dt);
    return;
  }

  if (state.phase === "victory" || state.phase === "defeat") {
    tickAnimations(state, dt);
    return;
  }

  tickAnimations(state, dt);
  tickSpawning(state, dt);
  tickSoldiersRobust(state, dt);
  tickStructures(state, dt);
  tickEnemies(state, dt);
  resolveFormationSeparation(state);
  cleanupDeadActors(state);
  resolveWaveState(state);
}

function processCommandQueue(state: NecromancerState): void {
  for (const command of state.pendingMoveCommands) assignFormationMove(state, command.soldierUids, command.x, command.y);
  for (const command of state.pendingTargetCommands) assignTarget(state, command.soldierUids, command.enemyUid);
  for (const command of state.pendingClearTargetCommands) clearTargets(state, command.soldierUids);
  for (const command of state.pendingReviveCommands) reviveSoldier(state, command.soldierUid);
  for (const command of state.pendingSmiteCommands) applySmiteStrike(state, command.x, command.y);
  for (const command of state.pendingBuildCommands) placeStructure(state, command.kind, command.x, command.y, command.rotation);
  for (const command of state.pendingTowerMountCommands) mountSoldierToTower(state, command.soldierUid, command.structureUid);
  for (const command of state.pendingUpgradeCommands) applyUpgrade(state, command);

  state.pendingMoveCommands = [];
  state.pendingTargetCommands = [];
  state.pendingClearTargetCommands = [];
  state.pendingReviveCommands = [];
  state.pendingSmiteCommands = [];
  state.pendingBuildCommands = [];
  state.pendingTowerMountCommands = [];
  state.pendingUpgradeCommands = [];
}

function assignFormationMove(state: NecromancerState, soldierUids: number[], x: number, y: number): void {
  const units = state.soldiers.filter((soldier) => soldierUids.includes(soldier.uid) && !soldier.dead);
  if (!units.length) return;

  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(units.length))));
  const spacing = 42;
  const rows = Math.ceil(units.length / columns);

  units.forEach((soldier, index) => {
    if (soldier.mountedStructureUid !== null) unmountSoldier(state, soldier);
    const column = index % columns;
    const row = Math.floor(index / columns);
    soldier.moveTargetX = clamp(x + (column - (columns - 1) / 2) * spacing, state.bounds.left + 18, state.bounds.right - 18);
    soldier.moveTargetY = clamp(y + (row - (rows - 1) / 2) * spacing, state.bounds.top + 18, state.bounds.bottom - 18);
    soldier.targetEnemyUid = null;
  });
}

function assignTarget(state: NecromancerState, soldierUids: number[], enemyUid: number): void {
  const enemy = state.enemies.find((candidate) => candidate.uid === enemyUid && !candidate.dead);
  if (!enemy) return;
  for (const soldier of state.soldiers) {
    if (!soldierUids.includes(soldier.uid) || soldier.dead) continue;
    if (soldier.mountedStructureUid !== null && soldier.path !== "ranger") unmountSoldier(state, soldier);
    soldier.targetEnemyUid = enemyUid;
    soldier.moveTargetX = null;
    soldier.moveTargetY = null;
  }
}

function clearTargets(state: NecromancerState, soldierUids: number[]): void {
  for (const soldier of state.soldiers) {
    if (!soldierUids.includes(soldier.uid) || soldier.dead) continue;
    soldier.targetEnemyUid = null;
  }
}

function reviveSoldier(state: NecromancerState, soldierUid: number): void {
  if (state.reviveCharges <= 0) return;
  const soldier = state.soldiers.find((candidate) => candidate.uid === soldierUid);
  if (!soldier || !soldier.dead || soldier.deathTimer > GHOST_REVIVE_WINDOW_SECONDS) return;

  const stats = effectiveStats(soldier);
  soldier.dead = false;
  soldier.deathTimer = 0;
  soldier.maxHp = stats.maxHp;
  soldier.hp = Math.round(stats.maxHp * 0.6);
  soldier.hitFlash = -1;
  soldier.attackCooldownLeft = 0.35;
  soldier.tauntCooldownLeft = 0;
  soldier.tauntActiveTimer = 0;
  soldier.chargeCooldownLeft = 0;
  soldier.dodgeCooldownLeft = 0;
  soldier.riseTimer = RISE_DURATION;
  soldier.moveTargetX = null;
  soldier.moveTargetY = null;
  soldier.targetEnemyUid = null;
  state.reviveCharges -= 1;
  spawnEffect(state, "guard", soldier.x, soldier.y, 28, 0.55, "rgba(196, 181, 253, 0.95)");
}

function placeStructure(state: NecromancerState, kind: BuildableKind, x: number, y: number, rotation = 0): void {
  if (state.phase !== "planning") return;
  const cost = buildCost(state, kind);
  if (state.gold < cost) return;

  const spec = BUILDABLE_STATS[kind];
  const blocked = state.structures.some(
    (structure) => !structure.dead && distance(structure.x, structure.y, x, y) < structure.radius + spec.radius + 10,
  );
  if (blocked) return;

  state.gold -= cost;
  state.structures.push({
    uid: nextUid(),
    kind,
    x: clamp(x, state.bounds.left + 22, state.bounds.right - 22),
    y: clamp(y, state.bounds.top + 22, state.bounds.bottom - 22),
    hp: spec.hp,
    maxHp: spec.hp,
    radius: spec.radius,
    rotation,
    dead: false,
    deathTimer: 0,
    ownerSoldierUid: null,
    charges: spec.charges,
  });
}

function mountSoldierToTower(state: NecromancerState, soldierUid: number, structureUid: number): void {
  const soldier = state.soldiers.find((candidate) => candidate.uid === soldierUid && !candidate.dead);
  const structure = state.structures.find((candidate) => candidate.uid === structureUid && !candidate.dead);
  if (!soldier || !structure || structure.kind !== "tower") return;
  if (structure.ownerSoldierUid !== null) return;
  if (soldier.path !== "ranger") return;
  if (soldier.mountedStructureUid !== null) unmountSoldier(state, soldier);

  structure.ownerSoldierUid = soldier.uid;
  soldier.mountedStructureUid = structure.uid;
  soldier.moveTargetX = null;
  soldier.moveTargetY = null;
  soldier.x = structure.x;
  soldier.y = structure.y - 12;
}

function unmountSoldier(state: NecromancerState, soldier: Soldier): void {
  if (soldier.mountedStructureUid === null) return;
  const structure = state.structures.find((candidate) => candidate.uid === soldier.mountedStructureUid);
  if (structure) structure.ownerSoldierUid = null;
  soldier.mountedStructureUid = null;
}

function applyUpgrade(state: NecromancerState, action: UpgradeAction): void {
  if (state.phase !== "planning") return;
  const soldier = state.soldiers.find((candidate) => candidate.uid === action.soldierUid && !candidate.dead);
  if (!soldier) return;

  const cost = upgradeCost(action, soldier);
  if (!Number.isFinite(cost) || state.gold < cost) return;

  if (action.kind === "choose-path" && action.path) {
    soldier.path = action.path;
  } else if (action.kind === "upgrade-branch" && soldier.path && action.branch) {
    if (soldier.upgradeLevels[action.branch] >= MAX_BRANCH_LEVEL) return;
    soldier.upgradeLevels[action.branch] += 1;
    soldier.pathLevel += 1;
  } else {
    return;
  }

  state.gold -= cost;
  const stats = effectiveStats(soldier);
  const hpRatio = soldier.maxHp > 0 ? soldier.hp / soldier.maxHp : 1;
  soldier.maxHp = stats.maxHp;
  soldier.hp = Math.max(1, Math.round(stats.maxHp * hpRatio));
}

function spawnEffect(
  state: NecromancerState,
  kind: EffectKind,
  x: number,
  y: number,
  radius: number,
  duration: number,
  color: string,
): void {
  state.effects.push({
    uid: nextUid(),
    kind,
    x,
    y,
    timer: duration,
    maxTimer: duration,
    radius,
    color,
  });
}

function spawnProjectile(
  state: NecromancerState,
  kind: ProjectileKind,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  duration: number,
  radius: number,
): void {
  const safeDuration = Math.max(0.08, duration);
  state.projectiles.push({
    uid: nextUid(),
    kind,
    x: fromX,
    y: fromY,
    vx: (toX - fromX) / safeDuration,
    vy: (toY - fromY) / safeDuration,
    timer: safeDuration,
    maxTimer: safeDuration,
    radius,
  });
}

function tickAnimations(state: NecromancerState, dt: number): void {
  state.smiteCooldownLeft = Math.max(0, state.smiteCooldownLeft - dt);

  for (const soldier of state.soldiers) {
    if (soldier.dead) {
      soldier.deathTimer += dt;
      continue;
    }
    if (soldier.hitFlash > 0) soldier.hitFlash = Math.max(0, soldier.hitFlash - dt * 5.5);
    if (soldier.hitFlash < 0) soldier.hitFlash = Math.min(0, soldier.hitFlash + dt * 4.5);
    soldier.attackCooldownLeft = Math.max(0, soldier.attackCooldownLeft - dt);
    soldier.tauntCooldownLeft = Math.max(0, soldier.tauntCooldownLeft - dt);
    soldier.tauntActiveTimer = Math.max(0, soldier.tauntActiveTimer - dt);
    soldier.chargeCooldownLeft = Math.max(0, soldier.chargeCooldownLeft - dt);
    soldier.dodgeCooldownLeft = Math.max(0, soldier.dodgeCooldownLeft - dt);
    if (soldier.riseTimer > 0) soldier.riseTimer = Math.max(0, soldier.riseTimer - dt);
    soldier.bobPhase += dt * BOB_SPEED;
  }

  for (const enemy of state.enemies) {
    if (enemy.dead) {
      enemy.deathTimer += dt;
      continue;
    }
    if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 7);
    enemy.attackCooldownLeft = Math.max(0, enemy.attackCooldownLeft - dt);
  }

  state.lightningStrikes = state.lightningStrikes
    .map((strike) => ({ ...strike, timer: Math.max(0, strike.timer - dt) }))
    .filter((strike) => strike.timer > 0);

  state.projectiles = state.projectiles
    .map((projectile) => ({
      ...projectile,
      x: projectile.x + projectile.vx * dt,
      y: projectile.y + projectile.vy * dt,
      timer: Math.max(0, projectile.timer - dt),
    }))
    .filter((projectile) => projectile.timer > 0);

  state.effects = state.effects
    .map((effect) => ({ ...effect, timer: Math.max(0, effect.timer - dt) }))
    .filter((effect) => effect.timer > 0);
}

function tickSpawning(state: NecromancerState, dt: number): void {
  if (!state.spawnQueue.length) return;
  for (const order of state.spawnQueue) order.delay -= dt;

  const ready = state.spawnQueue.filter((order) => order.delay <= 0);
  state.spawnQueue = state.spawnQueue.filter((order) => order.delay > 0);

  for (const order of ready) {
    const base = getEnemySpec(order.variant);
    const powerLevel = 1 + Math.floor((state.wave - 1) / 5) * 0.18 + (base.boss ? 0.28 : 0);
    state.enemies.push({
      uid: order.uid,
      variant: order.variant,
      name: base.label,
      powerLevel,
      x: order.x,
      y: order.y,
      hp: Math.round(base.maxHp * powerLevel),
      maxHp: Math.round(base.maxHp * powerLevel),
      attackCooldownLeft: randomUnit() * base.attackCooldown,
      dead: false,
      deathTimer: 0,
      spawnFromX: order.x,
      spawnFromY: order.y,
      targetSoldierUid: null,
      hitFlash: 0,
      damageContributors: {},
    });
  }
}

function tickStructures(state: NecromancerState, dt: number): void {
  for (const structure of state.structures) {
    if (structure.dead) {
      structure.deathTimer += dt;
      continue;
    }

    if (structure.kind === "spikeTrap" || structure.kind === "blastTrap") {
      const triggerEnemy = state.enemies.find(
        (enemy) => !enemy.dead && distance(enemy.x, enemy.y, structure.x, structure.y) <= structure.radius + 8,
      );
      if (!triggerEnemy || structure.charges <= 0) continue;

      if (structure.kind === "spikeTrap") {
        dealDamageToEnemy(state, triggerEnemy, 52);
        spawnEffect(state, "spike", structure.x, structure.y, 22, 0.28, "#fdba74");
      } else {
        for (const enemy of state.enemies) {
          if (enemy.dead) continue;
          if (distance(enemy.x, enemy.y, structure.x, structure.y) <= 58) {
            dealDamageToEnemy(state, enemy, 44);
          }
        }
        spawnEffect(state, "blast", structure.x, structure.y, 58, 0.42, "#fde68a");
      }

      structure.charges -= 1;
      if (structure.charges <= 0) {
        structure.dead = true;
        structure.deathTimer = 0;
      }
    }
  }
}

// Legacy global-pack loop retained temporarily for comparison while the robust
// subgroup leash logic settles in.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function tickSoldiers(state: NecromancerState, dt: number): void {
  const liveEnemies = state.enemies.filter((enemy) => !enemy.dead);

  // Coordinated focus: all unordered soldiers converge on the same threat —
  // the enemy closest to the squad's center of mass, not closest to each individual.
  const center = squadCenter(state.soldiers);
  const squadFocusEnemy = nearestEnemy(center.x, center.y, liveEnemies);

  for (const soldier of state.soldiers) {
    if (soldier.dead) continue;
    const stats = effectiveStats(soldier);
    const pinnedEnemy =
      soldier.targetEnemyUid !== null ? liveEnemies.find((enemy) => enemy.uid === soldier.targetEnemyUid) || null : null;
    const activeEnemy = pinnedEnemy || squadFocusEnemy;

    // Leash: a soldier drifting beyond leashRadius from the squad center (with no
    // explicit orders) pulls back toward the group rather than chasing indefinitely.
    if (!pinnedEnemy && soldier.moveTargetX === null) {
      const distFromCenter = distance(soldier.x, soldier.y, center.x, center.y);
      if (distFromCenter > stats.leashRadius) {
        moveTowardPoint(soldier, center.x, center.y, stats.moveSpeed, dt, state.bounds);
        continue;
      }
    }

    if (soldier.moveTargetX !== null && soldier.moveTargetY !== null) {
      const reachedMove = moveTowardPoint(soldier, soldier.moveTargetX, soldier.moveTargetY, stats.moveSpeed, dt, state.bounds);
      if (reachedMove) {
        soldier.moveTargetX = null;
        soldier.moveTargetY = null;
      }
      if (!pinnedEnemy) continue;
    }

    if (!activeEnemy) continue;

    const currentDistance = distance(soldier.x, soldier.y, activeEnemy.x, activeEnemy.y);
    if (currentDistance > stats.attackRange) {
      moveTowardEnemy(soldier, activeEnemy, stats, dt, state.bounds);
      continue;
    }

    if (soldier.path === "ranger" && currentDistance < stats.preferredDistance * 0.72) {
      kiteFromEnemy(state, soldier, activeEnemy, stats, dt, state.bounds);
      continue;
    }

    if (soldier.attackCooldownLeft <= 0) {
      dealDamageToEnemy(state, activeEnemy, stats.attackDamage);
      soldier.attackCooldownLeft = stats.attackCooldown;
      const direction = normalize(activeEnemy.x - soldier.x, activeEnemy.y - soldier.y);
      soldier.facingX = direction.x;
      soldier.facingY = direction.y;
    }
  }
}

function tickSoldiersRobust(state: NecromancerState, dt: number): void {
  const liveEnemies = state.enemies.filter((enemy) => !enemy.dead);

  for (const soldier of state.soldiers) {
    if (soldier.dead) continue;
    if (soldier.mountedStructureUid !== null) {
      const tower = state.structures.find((structure) => structure.uid === soldier.mountedStructureUid && !structure.dead);
      if (!tower) {
        unmountSoldier(state, soldier);
      } else {
        soldier.x = tower.x;
        soldier.y = tower.y - 12;
        const stats = effectiveStats(soldier);
        const target = nearestEnemy(tower.x, tower.y, liveEnemies);
        if (target && distance(tower.x, tower.y, target.x, target.y) <= stats.attackRange && soldier.attackCooldownLeft <= 0) {
          performSoldierAttack(state, soldier, target, stats);
          soldier.attackCooldownLeft = stats.attackCooldown;
          const direction = normalize(target.x - tower.x, target.y - tower.y);
          soldier.facingX = direction.x;
          soldier.facingY = direction.y;
        }
        continue;
      }
    }
    const stats = effectiveStats(soldier);
    const groupSoldiers = getSoldierGroup(state.soldiers, soldier);
    const groupCenter = squadCenter(groupSoldiers);
    const pinnedEnemy =
      soldier.targetEnemyUid !== null ? liveEnemies.find((enemy) => enemy.uid === soldier.targetEnemyUid) || null : null;
    const activeEnemy = pinnedEnemy || nearestEnemy(groupCenter.x, groupCenter.y, liveEnemies);
    const leashAnchor = desiredLeashAnchor(soldier, groupSoldiers, groupCenter, activeEnemy);

    triggerTauntIfReady(state, soldier, stats, liveEnemies);

    if (!pinnedEnemy && soldier.moveTargetX === null) {
      const distFromAnchor = distance(soldier.x, soldier.y, leashAnchor.x, leashAnchor.y);
      if (distFromAnchor > stats.leashRadius) {
        moveTowardPoint(soldier, leashAnchor.x, leashAnchor.y, stats.moveSpeed, dt, state.bounds);
        continue;
      }
    }

    if (soldier.moveTargetX !== null && soldier.moveTargetY !== null) {
      const reachedMove = moveTowardPoint(soldier, soldier.moveTargetX, soldier.moveTargetY, stats.moveSpeed, dt, state.bounds);
      if (reachedMove) {
        soldier.moveTargetX = null;
        soldier.moveTargetY = null;
      }
      if (!pinnedEnemy) continue;
    }

    if (!activeEnemy) continue;

    const currentDistance = distance(soldier.x, soldier.y, activeEnemy.x, activeEnemy.y);
    if (tryChargeAttack(state, soldier, activeEnemy, stats, currentDistance)) continue;

    if (currentDistance > stats.attackRange) {
      moveTowardEnemy(soldier, activeEnemy, stats, dt, state.bounds);
      continue;
    }

    if (soldier.path === "ranger" && currentDistance < stats.preferredDistance * 0.82) {
      kiteFromEnemy(state, soldier, activeEnemy, stats, dt, state.bounds);
      continue;
    }

    if (soldier.attackCooldownLeft <= 0) {
      performSoldierAttack(state, soldier, activeEnemy, stats);
      soldier.attackCooldownLeft = stats.attackCooldown;
      const direction = normalize(activeEnemy.x - soldier.x, activeEnemy.y - soldier.y);
      soldier.facingX = direction.x;
      soldier.facingY = direction.y;
    }
  }
}

function tickEnemies(state: NecromancerState, dt: number): void {
  const liveSoldiers = state.soldiers.filter((soldier) => !soldier.dead && soldier.mountedStructureUid === null);
  const liveStructures = state.structures.filter((structure) => !structure.dead);

  // Enemy swarm center — raiders use this to converge as a pack.
  const swarmCtr = swarmCenter(state.enemies);

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const base = getEnemySpec(enemy.variant);
    const attackDamage = base.attackDamage * enemy.powerLevel;

    // Validate cached target; fall back to variant-specific pick if stale or absent.
    const cachedTarget =
      enemy.targetSoldierUid !== null
        ? liveSoldiers.find((soldier) => soldier.uid === enemy.targetSoldierUid) || null
        : null;
    const target = cachedTarget || pickEnemyTarget(enemy, liveSoldiers, swarmCtr);
    const structureTarget = pickEnemyStructureTarget(enemy, target, liveStructures, state.bounds);
    if (!target && !structureTarget) continue;
    enemy.targetSoldierUid = structureTarget ? null : target?.uid ?? null;

    const targetX = structureTarget ? structureTarget.x : target!.x;
    const targetY = structureTarget ? structureTarget.y : target!.y;
    const targetDistance = distance(enemy.x, enemy.y, targetX, targetY);
    const detour = structureTarget ? null : findWallDetourPoint(enemy.x, enemy.y, targetX, targetY, liveStructures, state.bounds);

    if (targetDistance > base.attackRange) {
      const speedMultiplier = (base.role === "bruiser" || base.role === "tank" || base.boss) && targetDistance < 120 ? 1.45 : 1;
      moveGeneric(
        enemy,
        detour?.x ?? targetX,
        detour?.y ?? targetY,
        base.moveSpeed * speedMultiplier,
        dt,
        state.bounds,
      );
      continue;
    }

    if (!structureTarget && (base.role === "artillery" || enemy.variant === "lich") && targetDistance < 80) {
      const away = normalize(enemy.x - target!.x, enemy.y - target!.y);
      moveGeneric(enemy, enemy.x + away.x * 60, enemy.y + away.y * 60, base.moveSpeed * 0.9, dt, state.bounds);
      continue;
    }

    if (enemy.attackCooldownLeft <= 0) {
      if (base.role === "artillery" || enemy.variant === "lich") {
        spawnProjectile(state, "hex", enemy.x, enemy.y, targetX, targetY, 0.22, base.boss ? 7 : 5);
      } else {
        spawnEffect(state, "hit", targetX, targetY, structureTarget ? 18 : 16, 0.2, base.boss ? "#fca5a5" : "#fb7185");
      }

      if (structureTarget) {
        structureTarget.hp -= attackDamage;
        if (structureTarget.hp <= 0) destroyStructure(state, structureTarget);
      } else {
        const targetStats = effectiveStats(target!);
        target!.hp -= attackDamage * targetStats.defenseMultiplier;
        target!.hitFlash = 1;
        if (target!.path === "guardian" || targetStats.defenseMultiplier < 0.8) {
          spawnEffect(state, "guard", target!.x, target!.y, 20, 0.26, "#93c5fd");
        }
        if (target!.hp <= 0) {
          target!.hp = 0;
          target!.dead = true;
          target!.deathTimer = 0;
          target!.targetEnemyUid = null;
          target!.moveTargetX = null;
          target!.moveTargetY = null;
        }
      }
      enemy.attackCooldownLeft = base.attackCooldown;
    }
  }
}

function resolveFormationSeparation(state: NecromancerState): void {
  for (let i = 0; i < state.soldiers.length; i += 1) {
    const a = state.soldiers[i];
    if (a.dead) continue;
    for (let j = i + 1; j < state.soldiers.length; j += 1) {
      const b = state.soldiers[j];
      if (b.dead) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const gap = Math.hypot(dx, dy) || 1;
      const minGap =
        a.path === "ranger" && b.path === "ranger"
          ? 42
          : a.path === "ranger" || b.path === "ranger"
          ? 36
          : 26;
      if (gap >= minGap) continue;
      const push = (minGap - gap) * 0.5;
      const normal = { x: dx / gap, y: dy / gap };
      a.x = clamp(a.x + normal.x * push, state.bounds.left + 12, state.bounds.right - 12);
      a.y = clamp(a.y + normal.y * push, state.bounds.top + 12, state.bounds.bottom - 12);
      b.x = clamp(b.x - normal.x * push, state.bounds.left + 12, state.bounds.right - 12);
      b.y = clamp(b.y - normal.y * push, state.bounds.top + 12, state.bounds.bottom - 12);
    }
  }
}

function cleanupDeadActors(state: NecromancerState): void {
  state.enemies = state.enemies.filter((enemy) => !enemy.dead || enemy.deathTimer < 0.6);
  state.soldiers = state.soldiers.filter((soldier) => !soldier.dead || soldier.deathTimer < GHOST_REVIVE_WINDOW_SECONDS);
  state.structures = state.structures.filter((structure) => !structure.dead || structure.deathTimer < STRUCTURE_DECAY_SECONDS);
}

function resolveWaveState(state: NecromancerState): void {
  const livingSoldiers = state.soldiers.filter((soldier) => !soldier.dead);
  if (!livingSoldiers.length) {
    state.phase = "defeat";
    state.waveLabel = "The line has fallen";
    return;
  }

  if (state.spawnQueue.length > 0) return;
  if (state.enemies.some((enemy) => !enemy.dead)) return;

  state.phase = "planning";
  state.waveLabel = `Prepare for wave ${state.wave + 1}`;
  if (state.wave >= 3) state.reviveCharges += 1 + Math.floor(state.wave / 10);
  state.gold += 18 + state.wave * 6;
}

function nearestEnemy(x: number, y: number, enemies: Enemy[]): Enemy | null {
  let best: Enemy | null = null;
  let bestDistance = Infinity;
  for (const enemy of enemies) {
    const candidateDistance = distance(x, y, enemy.x, enemy.y);
    if (candidateDistance < bestDistance) {
      best = enemy;
      bestDistance = candidateDistance;
    }
  }
  return best;
}

function nearestSoldier(x: number, y: number, soldiers: Soldier[]): Soldier | null {
  let best: Soldier | null = null;
  let bestDistance = Infinity;
  for (const soldier of soldiers) {
    const candidateDistance = distance(x, y, soldier.x, soldier.y);
    if (candidateDistance < bestDistance) {
      best = soldier;
      bestDistance = candidateDistance;
    }
  }
  return best;
}

function moveTowardPoint(
  soldier: Soldier,
  x: number,
  y: number,
  moveSpeed: number,
  dt: number,
  bounds: BattlefieldBounds,
): boolean {
  const reached = moveGeneric(soldier, x, y, moveSpeed, dt, bounds);
  return reached;
}

function moveTowardEnemy(
  soldier: Soldier,
  enemy: Enemy,
  stats: EffectiveStats,
  dt: number,
  bounds: BattlefieldBounds,
): void {
  const direction = normalize(enemy.x - soldier.x, enemy.y - soldier.y);
  soldier.facingX = direction.x;
  soldier.facingY = direction.y;
  moveGeneric(soldier, enemy.x, enemy.y, stats.moveSpeed, dt, bounds);
}

function kiteFromEnemy(
  state: NecromancerState,
  soldier: Soldier,
  enemy: Enemy,
  stats: EffectiveStats,
  dt: number,
  bounds: BattlefieldBounds,
): void {
  const away = normalize(soldier.x - enemy.x, soldier.y - enemy.y);
  soldier.facingX = away.x;
  soldier.facingY = away.y;
  if (soldier.path === "ranger" && soldier.dodgeCooldownLeft <= 0) {
    soldier.dodgeCooldownLeft = 0.9;
    spawnEffect(state, "dodge", soldier.x, soldier.y, 20, 0.26, "#86efac");
  }
  moveGeneric(
    soldier,
    soldier.x + away.x * stats.swiftEscapeDistance,
    soldier.y + away.y * stats.swiftEscapeDistance,
    stats.moveSpeed * stats.swiftEscapeSpeedMultiplier,
    dt,
    bounds,
  );
}

function moveGeneric(
  actor: { x: number; y: number; facingX: number; facingY: number } | Enemy,
  targetX: number,
  targetY: number,
  moveSpeed: number,
  dt: number,
  bounds: BattlefieldBounds,
): boolean {
  const dx = targetX - actor.x;
  const dy = targetY - actor.y;
  const direction = normalize(dx, dy);
  const maxStep = moveSpeed * dt;
  const reached = direction.length <= maxStep;

  actor.x = clamp(actor.x + direction.x * Math.min(maxStep, direction.length), bounds.left, bounds.right);
  actor.y = clamp(actor.y + direction.y * Math.min(maxStep, direction.length), bounds.top, bounds.bottom);

  if ("facingX" in actor) {
    actor.facingX = direction.x;
    actor.facingY = direction.y;
  }

  return reached;
}

function triggerTauntIfReady(state: NecromancerState, soldier: Soldier, stats: EffectiveStats, enemies: Enemy[]): void {
  if (soldier.path !== "guardian" || soldier.upgradeLevels.special <= 0) return;
  if (soldier.tauntCooldownLeft > 0 || soldier.tauntActiveTimer > 0) return;

  const nearbyIdleEnemy = enemies.find(
    (enemy) =>
      enemy.targetSoldierUid === null &&
      distance(enemy.x, enemy.y, soldier.x, soldier.y) <= stats.tauntRadius,
  );
  if (!nearbyIdleEnemy) return;

  soldier.tauntCooldownLeft = stats.tauntCooldown;
  soldier.tauntActiveTimer = stats.tauntDuration;
  spawnEffect(state, "taunt", soldier.x, soldier.y, stats.tauntRadius, 0.45, "#93c5fd");
}

function tryChargeAttack(
  state: NecromancerState,
  soldier: Soldier,
  enemy: Enemy,
  stats: EffectiveStats,
  currentDistance: number,
): boolean {
  if (soldier.path !== "warrior" || soldier.upgradeLevels.special <= 0) return false;
  if (soldier.chargeCooldownLeft > 0) return false;
  if (currentDistance <= stats.attackRange * 1.3 || currentDistance > stats.chargeRange) return false;

  const direction = normalize(enemy.x - soldier.x, enemy.y - soldier.y);
  const chargeDistance = Math.min(currentDistance, stats.chargeRange);
  const endX = clamp(soldier.x + direction.x * chargeDistance, state.bounds.left, state.bounds.right);
  const endY = clamp(soldier.y + direction.y * chargeDistance, state.bounds.top, state.bounds.bottom);

  for (const candidate of state.enemies) {
    if (candidate.dead) continue;
    const lineDistance = distanceToSegment(candidate.x, candidate.y, soldier.x, soldier.y, endX, endY);
    if (lineDistance > stats.chargeWidth) continue;
    dealDamageToEnemy(state, candidate, stats.attackDamage * stats.chargeDamageMultiplier, soldier.uid);
  }

  spawnEffect(state, "whirlwind", endX, endY, stats.chargeWidth * 1.25, 0.45, "#fdba74");
  soldier.x = endX;
  soldier.y = endY;
  soldier.facingX = direction.x;
  soldier.facingY = direction.y;
  soldier.chargeCooldownLeft = stats.chargeCooldown;
  soldier.attackCooldownLeft = stats.attackCooldown * 0.9;
  return true;
}

function performSoldierAttack(state: NecromancerState, soldier: Soldier, enemy: Enemy, stats: EffectiveStats): void {
  let damage = stats.attackDamage;
  const projectileKind: ProjectileKind | null =
    soldier.path === "ranger" ? "arrow" : soldier.path === null ? "bone" : null;

  if (stats.critChance > 0 && randomUnit() < stats.critChance) {
    damage *= stats.critMultiplier;
    spawnEffect(state, "hit", enemy.x, enemy.y, 24, 0.28, "#fde68a");
  }

  if (projectileKind) {
    spawnProjectile(state, projectileKind, soldier.x, soldier.y, enemy.x, enemy.y, 0.18, soldier.path === "ranger" ? 5 : 4);
  } else {
    spawnEffect(state, "hit", enemy.x, enemy.y, 18, 0.22, "#fb923c");
  }
  dealDamageToEnemy(state, enemy, damage, soldier.uid);

  if (!enemy.dead && stats.comboChance > 0 && randomUnit() < stats.comboChance) {
    spawnEffect(state, "whirlwind", enemy.x, enemy.y, 30, 0.48, "#f59e0b");
    dealDamageToEnemy(state, enemy, damage * stats.comboMultiplier, soldier.uid);
  }
}

function dealDamageToEnemy(state: NecromancerState, enemy: Enemy, damage: number, attackerUid?: number): void {
  if (attackerUid !== undefined) {
    enemy.damageContributors[attackerUid] = (enemy.damageContributors[attackerUid] || 0) + damage;
  }
  enemy.hp -= damage;
  enemy.hitFlash = 1;
  if (enemy.hp > 0) return;

  enemy.hp = 0;
  enemy.dead = true;
  enemy.deathTimer = 0;
  awardEnemyExperience(state, enemy, attackerUid);
  const reward = getEnemySpec(enemy.variant);
  state.gold += Math.round(reward.gold * enemy.powerLevel);
  state.score += Math.round(reward.score * enemy.powerLevel);
  awardKillDrops(state, enemy.variant);
}

function awardEnemyExperience(state: NecromancerState, enemy: Enemy, killerUid?: number): void {
  const contributorUids = Object.keys(enemy.damageContributors).map((key) => Number(key));
  const awarded = new Set<number>();

  if (killerUid !== undefined) {
    awardSoldierExperience(state, killerUid, KILL_XP);
    awarded.add(killerUid);
  }

  for (const uid of contributorUids) {
    if (awarded.has(uid)) continue;
    awardSoldierExperience(state, uid, ASSIST_XP);
  }
}

function awardSoldierExperience(state: NecromancerState, soldierUid: number, xp: number): void {
  const soldier = state.soldiers.find((candidate) => candidate.uid === soldierUid && !candidate.dead);
  if (!soldier) return;

  soldier.experience += xp;
  let requiredXp = levelXpThreshold(soldier.level);
  while (soldier.experience >= requiredXp) {
    soldier.experience -= requiredXp;
    soldier.level += 1;
    const oldMaxHp = soldier.maxHp;
    const leveledStats = effectiveStats(soldier);
    soldier.maxHp = leveledStats.maxHp;
    soldier.hp = Math.min(soldier.maxHp, soldier.hp + Math.max(12, soldier.maxHp - oldMaxHp));
    requiredXp = levelXpThreshold(soldier.level);
  }
}

function levelXpThreshold(level: number): number {
  return 24 + (level - 1) * 12;
}

function awardKillDrops(state: NecromancerState, variant: EnemyVariant): void {
  if (randomUnit() < HEAL_ON_KILL_CHANCE) {
    const wounded = state.soldiers
      .filter((soldier) => !soldier.dead && soldier.hp < soldier.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (wounded) {
      wounded.hp = Math.min(wounded.maxHp, wounded.hp + wounded.maxHp * HEAL_ON_KILL_RATIO);
      wounded.hitFlash = -1;
    }
  }

  if (randomUnit() < getEnemySpec(variant).reviveDropChance) {
    state.reviveCharges += 1;
  }
}

function applySmiteStrike(state: NecromancerState, x: number, y: number): void {
  if (state.smiteCooldownLeft > 0) return;

  state.smiteCooldownLeft = SMITE_COOLDOWN_SECONDS;
  state.lightningStrikes.push({
    x,
    y,
    timer: SMITE_EFFECT_DURATION,
    radius: SMITE_RADIUS,
  });
  spawnEffect(state, "smite", x, y, SMITE_RADIUS, 0.46, "rgba(191, 219, 254, 0.95)");
  spawnProjectile(state, "smite", x, 0, x, y, 0.16, 7);

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    if (distance(enemy.x, enemy.y, x, y) > SMITE_RADIUS) continue;
    dealDamageToEnemy(state, enemy, SMITE_DAMAGE);
  }
}

// ── Team helpers ──────────────────────────────────────────────────────────────

/** Average position of all living soldiers — used for coordinated targeting and leash. */
function squadCenter(soldiers: Soldier[]): { x: number; y: number } {
  const living = soldiers.filter((s) => !s.dead);
  if (!living.length) return { x: 0, y: 0 };
  return {
    x: living.reduce((sum, s) => sum + s.x, 0) / living.length,
    y: living.reduce((sum, s) => sum + s.y, 0) / living.length,
  };
}

/** Average position of all living enemies — used by raider pack targeting. */
function getSoldierGroup(soldiers: Soldier[], soldier: Soldier): Soldier[] {
  const living = soldiers.filter((candidate) => !candidate.dead);

  if (soldier.moveTargetX !== null && soldier.moveTargetY !== null) {
    return living.filter(
      (candidate) =>
        candidate.moveTargetX !== null &&
        candidate.moveTargetY !== null &&
        distance(candidate.moveTargetX, candidate.moveTargetY, soldier.moveTargetX!, soldier.moveTargetY!) <= ORDER_GROUP_RADIUS,
    );
  }

  if (soldier.targetEnemyUid !== null) {
    const pinnedGroup = living.filter((candidate) => candidate.targetEnemyUid === soldier.targetEnemyUid);
    if (pinnedGroup.length) return pinnedGroup;
  }

  const localGroup = living.filter((candidate) => distance(candidate.x, candidate.y, soldier.x, soldier.y) <= LOCAL_GROUP_RADIUS);
  return localGroup.length ? localGroup : [soldier];
}

function desiredLeashAnchor(
  soldier: Soldier,
  groupSoldiers: Soldier[],
  groupCenter: { x: number; y: number },
  activeEnemy: Enemy | null,
): { x: number; y: number } {
  if (soldier.path !== "ranger") return groupCenter;

  const frontline = groupSoldiers.filter((candidate) => candidate.uid !== soldier.uid && candidate.path !== "ranger");
  const anchorBase = frontline.length ? squadCenter(frontline) : groupCenter;

  if (activeEnemy) {
    const away = normalize(anchorBase.x - activeEnemy.x, anchorBase.y - activeEnemy.y);
    return {
      x: anchorBase.x + away.x * RANGER_SUPPORT_OFFSET,
      y: anchorBase.y + away.y * RANGER_SUPPORT_OFFSET,
    };
  }

  if (groupSoldiers.length > 1) {
    const others = groupSoldiers.filter((candidate) => candidate.uid !== soldier.uid);
    const crowdCenter = others.length ? squadCenter(others) : groupCenter;
    const away = normalize(soldier.x - crowdCenter.x, soldier.y - crowdCenter.y);
    return {
      x: crowdCenter.x + away.x * (RANGER_SUPPORT_OFFSET * 0.7),
      y: crowdCenter.y + away.y * (RANGER_SUPPORT_OFFSET * 0.7),
    };
  }

  return groupCenter;
}

function swarmCenter(enemies: Enemy[]): { x: number; y: number } {
  const living = enemies.filter((e) => !e.dead);
  if (!living.length) return { x: 0, y: 0 };
  return {
    x: living.reduce((sum, e) => sum + e.x, 0) / living.length,
    y: living.reduce((sum, e) => sum + e.y, 0) / living.length,
  };
}

/**
 * Per-variant enemy targeting strategy:
 *   Raiders  — target the soldier nearest the swarm center (pack up, hit together)
 *   Hexers   — target the soldier with the lowest HP % (snipe the weakest)
 *   Brutes   — target the soldier nearest to themselves (push straight through)
 */
function pickEnemyTarget(
  enemy: Enemy,
  liveSoldiers: Soldier[],
  swarmCtr: { x: number; y: number },
): Soldier | null {
  if (!liveSoldiers.length) return null;
  const spec = getEnemySpec(enemy.variant);
  const tauntingGuardian = pickTauntingGuardian(enemy, liveSoldiers);
  if (tauntingGuardian) return tauntingGuardian;
  if (spec.role === "artillery") {
    return liveSoldiers.reduce(
      (weakest, s) => s.hp / s.maxHp < weakest.hp / weakest.maxHp ? s : weakest,
      liveSoldiers[0],
    );
  }
  if (spec.role === "bruiser" || spec.role === "tank" || enemy.variant === "warlord" || enemy.variant === "colossus") {
    return nearestSoldier(enemy.x, enemy.y, liveSoldiers);
  }
  if (spec.role === "assassin") {
    const ranger = liveSoldiers
      .filter((soldier) => soldier.path === "ranger")
      .sort((a, b) => distance(enemy.x, enemy.y, a.x, a.y) - distance(enemy.x, enemy.y, b.x, b.y))[0];
    if (ranger) return ranger;
    return liveSoldiers.reduce(
      (weakest, s) => s.hp / s.maxHp < weakest.hp / weakest.maxHp ? s : weakest,
      liveSoldiers[0],
    );
  }
  // raider: converge on the soldier closest to the swarm center
  return nearestSoldier(swarmCtr.x, swarmCtr.y, liveSoldiers);
}

function pickTauntingGuardian(enemy: Enemy, liveSoldiers: Soldier[]): Soldier | null {
  let bestGuardian: Soldier | null = null;
  let bestScore = -Infinity;

  for (const soldier of liveSoldiers) {
    if (soldier.path !== "guardian" || soldier.tauntActiveTimer <= 0) continue;
    const soldierStats = effectiveStats(soldier);
    const dist = distance(enemy.x, enemy.y, soldier.x, soldier.y);
    if (dist > soldierStats.tauntRadius) continue;

    const score = GUARDIAN_TAUNT_WEIGHT + soldier.upgradeLevels.special * 12 - dist;
    if (score > bestScore) {
      bestGuardian = soldier;
      bestScore = score;
    }
  }

  return bestGuardian;
}

function pickEnemyStructureTarget(
  enemy: Enemy,
  targetSoldier: Soldier | null,
  structures: Structure[],
  bounds: BattlefieldBounds,
): Structure | null {
  let best: Structure | null = null;
  let bestScore = Infinity;
  const walls = structures.filter((structure) => structure.kind === "wall");

  for (const structure of structures) {
    const dist = distance(enemy.x, enemy.y, structure.x, structure.y);
    if (structure.kind === "tower" && structure.ownerSoldierUid !== null && dist <= STRUCTURE_TARGET_RADIUS * 1.35) {
      if (dist < bestScore) {
        best = structure;
        bestScore = dist;
      }
      continue;
    }
    if ((structure.kind === "wall" || structure.kind === "tower") && dist <= STRUCTURE_TARGET_RADIUS) {
      const soldierDistance = targetSoldier ? distance(enemy.x, enemy.y, targetSoldier.x, targetSoldier.y) : Infinity;
      const interceptBonus = structure.kind === "wall" ? 14 : 0;
      const blockedTarget =
        targetSoldier &&
        structure.kind === "wall" &&
        isStructureBlockingPath(structure, enemy.x, enemy.y, targetSoldier.x, targetSoldier.y);
      const detourExists =
        blockedTarget &&
        findWallDetourPoint(enemy.x, enemy.y, targetSoldier.x, targetSoldier.y, walls, bounds) !== null;
      if ((structure.kind === "tower" || (blockedTarget && !detourExists)) && dist - interceptBonus < soldierDistance && dist < bestScore) {
        best = structure;
        bestScore = dist;
      }
    }
  }

  return best;
}

function isStructureBlockingPath(structure: Structure, ax: number, ay: number, bx: number, by: number): boolean {
  if (structure.kind !== "wall") return false;
  return distanceToSegment(structure.x, structure.y, ax, ay, bx, by) <= structure.radius + 8;
}

function findWallDetourPoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  structures: Structure[],
  bounds: BattlefieldBounds,
): { x: number; y: number } | null {
  const walls = structures.filter((structure) => structure.kind === "wall" && !structure.dead);
  const blockingWall = walls
    .filter((wall) => isStructureBlockingPath(wall, ax, ay, bx, by))
    .sort((a, b) => distance(ax, ay, a.x, a.y) - distance(ax, ay, b.x, b.y))[0];

  if (!blockingWall) return null;

  const travel = normalize(bx - ax, by - ay);
  const perp = { x: -travel.y, y: travel.x };
  const clearance = blockingWall.radius + 28;
  const lead = blockingWall.radius + 20;
  const candidates = [
    {
      x: clamp(blockingWall.x + perp.x * clearance + travel.x * lead, bounds.left, bounds.right),
      y: clamp(blockingWall.y + perp.y * clearance + travel.y * lead, bounds.top, bounds.bottom),
    },
    {
      x: clamp(blockingWall.x - perp.x * clearance + travel.x * lead, bounds.left, bounds.right),
      y: clamp(blockingWall.y - perp.y * clearance + travel.y * lead, bounds.top, bounds.bottom),
    },
  ];

  const viable = candidates
    .filter((candidate) => !walls.some((wall) => distance(candidate.x, candidate.y, wall.x, wall.y) < wall.radius + 12))
    .sort((a, b) => distance(a.x, a.y, bx, by) - distance(b.x, b.y, bx, by));

  return viable[0] ?? null;
}

function destroyStructure(state: NecromancerState, structure: Structure): void {
  if (structure.dead) return;
  structure.dead = true;
  structure.deathTimer = 0;
  if (structure.ownerSoldierUid !== null) {
    const soldier = state.soldiers.find((candidate) => candidate.uid === structure.ownerSoldierUid && !candidate.dead);
    if (soldier) {
      soldier.mountedStructureUid = null;
      soldier.x = structure.x;
      soldier.y = structure.y + structure.radius + 10;
    }
    structure.ownerSoldierUid = null;
  }
}

export function queueMoveCommand(state: NecromancerState, soldierUids: number[], x: number, y: number): void {
  state.pendingMoveCommands.push({ soldierUids, x, y });
}

export function queueTargetCommand(state: NecromancerState, soldierUids: number[], enemyUid: number): void {
  state.pendingTargetCommands.push({ soldierUids, enemyUid });
}

export function queueClearTargetCommand(state: NecromancerState, soldierUids: number[]): void {
  state.pendingClearTargetCommands.push({ soldierUids });
}

export function queueReviveCommand(state: NecromancerState, soldierUid: number): void {
  state.pendingReviveCommands.push({ soldierUid });
}

export function queueSmiteCommand(state: NecromancerState, x: number, y: number): void {
  state.pendingSmiteCommands.push({ x, y });
}

export function queueBuildCommand(state: NecromancerState, kind: BuildableKind, x: number, y: number, rotation = 0): void {
  state.pendingBuildCommands.push({ kind, x, y, rotation });
}

export function queueTowerMountCommand(state: NecromancerState, soldierUid: number, structureUid: number): void {
  state.pendingTowerMountCommands.push({ soldierUid, structureUid });
}

export function queueUpgrade(state: NecromancerState, action: UpgradeAction): void {
  state.pendingUpgradeCommands.push(action);
}
