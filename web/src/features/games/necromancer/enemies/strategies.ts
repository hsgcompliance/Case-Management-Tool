import type { EnemyVariant } from "./catalog";

export interface StrategyBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface StrategySpawnOrder {
  uid: number;
  variant: EnemyVariant;
  x: number;
  y: number;
  delay: number;
}

export interface StrategyWaveDefinition {
  wave: number;
  label: string;
  spawnOrders: StrategySpawnOrder[];
  reviveReward: number;
  bossWave: boolean;
}

type NextUid = () => number;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function edgeAnchor(bounds: StrategyBounds, side: number, progress: number): { x: number; y: number } {
  const p = clamp(progress, 0.08, 0.92);
  if (side === 0) return { x: bounds.left + bounds.width * p, y: bounds.top };
  if (side === 1) return { x: bounds.right, y: bounds.top + bounds.height * p };
  if (side === 2) return { x: bounds.right - bounds.width * p, y: bounds.bottom };
  return { x: bounds.left, y: bounds.bottom - bounds.height * p };
}

function pushCluster(
  out: StrategySpawnOrder[],
  bounds: StrategyBounds,
  nextUid: NextUid,
  variant: EnemyVariant,
  side: number,
  progress: number,
  count: number,
  startDelay: number,
  spacing = 18,
  burstDelay = 0.12,
): number {
  const anchor = edgeAnchor(bounds, side % 4, progress);
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * spacing;
    const x = side % 2 === 0 ? anchor.x + offset : anchor.x;
    const y = side % 2 === 0 ? anchor.y : anchor.y + offset;
    out.push({
      uid: nextUid(),
      variant,
      x: clamp(x, bounds.left, bounds.right),
      y: clamp(y, bounds.top, bounds.bottom),
      delay: startDelay + index * burstDelay,
    });
  }
  return startDelay + count * burstDelay;
}

function baselineCount(wave: number, tier: number): number {
  return 6 + Math.floor(wave * 1.7) + tier * 2;
}

function buildBossWave(bounds: StrategyBounds, wave: number, tier: number, nextUid: NextUid): StrategyWaveDefinition {
  const orders: StrategySpawnOrder[] = [];
  const bossVariant: EnemyVariant =
    wave % 15 === 0 ? "colossus" : wave % 10 === 0 ? "lich" : "warlord";

  let delay = 0;
  delay = pushCluster(orders, bounds, nextUid, "raider", (wave + 1) % 4, 0.24, 4 + tier, delay, 20, 0.1);
  delay += 0.4;
  delay = pushCluster(orders, bounds, nextUid, "hexer", (wave + 2) % 4, 0.68, 2 + Math.floor(tier / 2), delay, 22, 0.14);
  delay += 0.5;
  orders.push({
    uid: nextUid(),
    variant: bossVariant,
    x: bounds.centerX,
    y: wave % 2 === 0 ? bounds.top : bounds.bottom,
    delay,
  });
  delay += 0.5;
  pushCluster(orders, bounds, nextUid, tier >= 2 ? "crusher" : "brute", wave % 4, 0.5, 2 + Math.floor(tier / 2), delay, 24, 0.16);

  return {
    wave,
    label: `${bossVariant === "warlord" ? "Warlord" : bossVariant === "lich" ? "Lich" : "Colossus"} Assault`,
    spawnOrders: orders,
    reviveReward: 1 + Math.floor(tier / 2),
    bossWave: true,
  };
}

function buildEncirclement(bounds: StrategyBounds, wave: number, tier: number, nextUid: NextUid): StrategyWaveDefinition {
  const orders: StrategySpawnOrder[] = [];
  const count = baselineCount(wave, tier);
  const perSide = Math.max(3, Math.floor(count / 4));
  let delay = 0;
  for (let side = 0; side < 4; side += 1) {
    delay = pushCluster(orders, bounds, nextUid, "raider", side, 0.25 + side * 0.15, perSide, delay, 18, 0.08);
    if (tier >= 1) delay = pushCluster(orders, bounds, nextUid, "stalker", side, 0.68, 1 + Math.floor(tier / 2), delay + 0.08, 16, 0.08);
  }
  return { wave, label: "Encirclement", spawnOrders: orders, reviveReward: tier >= 2 ? 1 : 0, bossWave: false };
}

function buildSiegeLine(bounds: StrategyBounds, wave: number, tier: number, nextUid: NextUid): StrategyWaveDefinition {
  const orders: StrategySpawnOrder[] = [];
  let delay = 0;
  delay = pushCluster(orders, bounds, nextUid, "hexer", wave % 2 === 0 ? 0 : 2, 0.35, 4 + tier, delay, 22, 0.12);
  delay = pushCluster(orders, bounds, nextUid, "hexer", wave % 2 === 0 ? 0 : 2, 0.62, 4 + tier, delay + 0.16, 22, 0.12);
  delay += 0.35;
  delay = pushCluster(orders, bounds, nextUid, tier >= 2 ? "crusher" : "brute", wave % 2 === 0 ? 1 : 3, 0.5, 2 + Math.floor(tier / 2), delay, 24, 0.14);
  pushCluster(orders, bounds, nextUid, "raider", wave % 2 === 0 ? 1 : 3, 0.28, 4 + tier, delay + 0.18, 18, 0.08);
  return { wave, label: "Siege Line", spawnOrders: orders, reviveReward: tier >= 1 ? 1 : 0, bossWave: false };
}

function buildHunterSplit(bounds: StrategyBounds, wave: number, tier: number, nextUid: NextUid): StrategyWaveDefinition {
  const orders: StrategySpawnOrder[] = [];
  let delay = 0;
  delay = pushCluster(orders, bounds, nextUid, "stalker", 1, 0.28, 4 + tier, delay, 16, 0.08);
  delay = pushCluster(orders, bounds, nextUid, "stalker", 3, 0.72, 4 + tier, delay + 0.08, 16, 0.08);
  delay += 0.3;
  delay = pushCluster(orders, bounds, nextUid, "raider", 0, 0.52, 5 + tier, delay, 18, 0.08);
  pushCluster(orders, bounds, nextUid, "hexer", 2, 0.52, 2 + Math.floor(tier / 2), delay + 0.2, 22, 0.12);
  return { wave, label: "Hunter Split", spawnOrders: orders, reviveReward: 1, bossWave: false };
}

function buildCrusherWedge(bounds: StrategyBounds, wave: number, tier: number, nextUid: NextUid): StrategyWaveDefinition {
  const orders: StrategySpawnOrder[] = [];
  const front = tier >= 1 ? "crusher" : "brute";
  let delay = 0;
  delay = pushCluster(orders, bounds, nextUid, front, wave % 2 === 0 ? 0 : 2, 0.5, 3 + Math.floor(tier / 2), delay, 24, 0.16);
  delay += 0.22;
  delay = pushCluster(orders, bounds, nextUid, "raider", wave % 2 === 0 ? 0 : 2, 0.32, 5 + tier, delay, 18, 0.08);
  pushCluster(orders, bounds, nextUid, "stalker", wave % 2 === 0 ? 1 : 3, 0.66, 2 + tier, delay + 0.12, 16, 0.08);
  return { wave, label: "Crusher Wedge", spawnOrders: orders, reviveReward: 1, bossWave: false };
}

export function buildEnemyWave(bounds: StrategyBounds, wave: number, nextUid: NextUid): StrategyWaveDefinition {
  const tier = Math.floor((wave - 1) / 5);
  if (wave % 5 === 0) return buildBossWave(bounds, wave, tier, nextUid);

  const cycle = tier % 4;
  if (cycle === 0) return buildEncirclement(bounds, wave, tier, nextUid);
  if (cycle === 1) return buildSiegeLine(bounds, wave, tier, nextUid);
  if (cycle === 2) return buildHunterSplit(bounds, wave, tier, nextUid);
  return buildCrusherWedge(bounds, wave, tier, nextUid);
}
