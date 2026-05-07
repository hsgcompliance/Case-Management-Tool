export type EnemyRole = "swarm" | "artillery" | "bruiser" | "assassin" | "tank" | "boss";

export type EnemyVariant =
  | "raider"
  | "hexer"
  | "brute"
  | "stalker"
  | "crusher"
  | "warlord"
  | "lich"
  | "colossus";

export interface EnemySpec {
  label: string;
  color: string;
  radius: number;
  role: EnemyRole;
  boss: boolean;
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  gold: number;
  score: number;
  reviveDropChance: number;
}

export const ENEMY_CATALOG: Record<EnemyVariant, EnemySpec> = {
  raider: {
    label: "Bone Raider",
    color: "#fca5a5",
    radius: 9,
    role: "swarm",
    boss: false,
    maxHp: 54,
    moveSpeed: 78,
    attackDamage: 11,
    attackRange: 22,
    attackCooldown: 1.1,
    gold: 9,
    score: 14,
    reviveDropChance: 0.08,
  },
  hexer: {
    label: "Grave Hexer",
    color: "#c084fc",
    radius: 9,
    role: "artillery",
    boss: false,
    maxHp: 44,
    moveSpeed: 60,
    attackDamage: 15,
    attackRange: 120,
    attackCooldown: 1.8,
    gold: 14,
    score: 22,
    reviveDropChance: 0.16,
  },
  brute: {
    label: "Rot Brute",
    color: "#fb7185",
    radius: 12,
    role: "bruiser",
    boss: false,
    maxHp: 120,
    moveSpeed: 48,
    attackDamage: 22,
    attackRange: 28,
    attackCooldown: 1.7,
    gold: 24,
    score: 36,
    reviveDropChance: 1,
  },
  stalker: {
    label: "Ghoul Stalker",
    color: "#fdba74",
    radius: 8,
    role: "assassin",
    boss: false,
    maxHp: 58,
    moveSpeed: 108,
    attackDamage: 18,
    attackRange: 20,
    attackCooldown: 0.9,
    gold: 18,
    score: 28,
    reviveDropChance: 0.18,
  },
  crusher: {
    label: "Crypt Crusher",
    color: "#ef4444",
    radius: 13,
    role: "tank",
    boss: false,
    maxHp: 170,
    moveSpeed: 42,
    attackDamage: 28,
    attackRange: 30,
    attackCooldown: 1.8,
    gold: 28,
    score: 42,
    reviveDropChance: 1,
  },
  warlord: {
    label: "Bone Warlord",
    color: "#f97316",
    radius: 16,
    role: "boss",
    boss: true,
    maxHp: 420,
    moveSpeed: 56,
    attackDamage: 36,
    attackRange: 34,
    attackCooldown: 1.2,
    gold: 72,
    score: 120,
    reviveDropChance: 1,
  },
  lich: {
    label: "Moon Lich",
    color: "#8b5cf6",
    radius: 15,
    role: "boss",
    boss: true,
    maxHp: 340,
    moveSpeed: 52,
    attackDamage: 32,
    attackRange: 180,
    attackCooldown: 1.55,
    gold: 76,
    score: 132,
    reviveDropChance: 1,
  },
  colossus: {
    label: "Grave Colossus",
    color: "#dc2626",
    radius: 18,
    role: "boss",
    boss: true,
    maxHp: 560,
    moveSpeed: 36,
    attackDamage: 48,
    attackRange: 38,
    attackCooldown: 1.95,
    gold: 88,
    score: 156,
    reviveDropChance: 1,
  },
};

export function getEnemySpec(variant: EnemyVariant): EnemySpec {
  return ENEMY_CATALOG[variant];
}
