// web/src/features/games/effects/cardPhysicsEngine.ts
// Pure types, CSS strings, and collision geometry for the card-physics engine.
// No React, no game registry — safe to import anywhere.

// ─── ID namespacing ───────────────────────────────────────────────────────────
//
// Cards on different pages can share the same underlying Firestore ID
// (e.g. a grant ID could theoretically equal a customer ID, or a line-item card
// and its parent grant card could be on the same page simultaneously).
//
// Always build physics IDs through this helper so namespaces never collide.
//
// Established prefixes:
//   customer        — CustomerCard               customer:{customerId}
//   grant           — grant-level card           grant:{grantId}
//   grant-li        — line-item card             grant-li:{grantId}:{lineItemId}
//   grant-row       — GrantRow / ProgramRow list row   grant-row:{grantId}
//   pinned-grant    — PinnedGrantCard / Small    pinned-grant:{grantId}
//   pinned-cc       — PinnedCreditCardSmallCard  pinned-cc:{cardId}
//
// Add new prefixes here as physics is extended to more card types.

export type CardPhysicsIdType =
  | "customer"
  | "grant"
  | "grant-li"
  | "grant-row"
  | "pinned-grant"
  | "pinned-cc";

/**
 * Build a namespaced card physics ID.
 *
 * @example
 * buildCardPhysicsId("customer", customerId)
 * buildCardPhysicsId("grant-li", grantId, lineItemId)
 */
export function buildCardPhysicsId(
  type: CardPhysicsIdType,
  ...segments: string[]
): string {
  return [type, ...segments].join(":");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardPhysicsState = "normal" | "damaged" | "falling" | "fallen";

export interface CardPhysicsRecord {
  id: string;
  state: CardPhysicsState;
  hp: number;       // starts at CARD_PHYSICS_HP, 0 = collapsed
  fallenAt?: number; // ms epoch, for auto-reset
}

export const CARD_PHYSICS_HP = 2;           // hits to collapse
export const FALLEN_RESET_MS = 10 * 60_000; // 10 min auto-reset

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = (uid: string) => `hdb_card_physics_${uid}`;

export function loadCardPhysics(uid: string): Record<string, CardPhysicsRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(uid));
    return raw ? (JSON.parse(raw) as Record<string, CardPhysicsRecord>) : {};
  } catch {
    return {};
  }
}

export function saveCardPhysics(uid: string, records: Record<string, CardPhysicsRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY(uid), JSON.stringify(records));
  } catch {}
}

// ─── Trajectory & collision ───────────────────────────────────────────────────

export interface AsteroidTrajectory {
  startX: number;    // viewport px
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
}

export interface CardHitSchedule {
  cardId: string;
  hitTimeMs: number; // ms after trajectory start when the asteroid reaches the card
}

/**
 * Scans all [data-card-physics-id] elements in the current viewport and returns
 * timed hit events for cards whose bounding rect intersects the asteroid's path.
 *
 * The asteroid is modeled as a circle of `radius` px traveling in a straight line
 * from (startX, startY) to (endX, endY) over `durationMs` milliseconds.
 */
export function computeAsteroidHits(
  trajectory: AsteroidTrajectory,
  radius = 28,
): CardHitSchedule[] {
  if (typeof document === "undefined") return [];

  const els = Array.from(
    document.querySelectorAll<HTMLElement>("[data-card-physics-id]"),
  );
  if (!els.length) return [];

  const { startX, startY, endX, endY, durationMs } = trajectory;
  const dx = endX - startX;
  const dy = endY - startY;

  const hits: CardHitSchedule[] = [];

  for (const el of els) {
    const cardId = el.getAttribute("data-card-physics-id");
    if (!cardId) continue;
    // Skip already-fallen cards
    if (el.hasAttribute("data-card-physics-fallen")) continue;

    const rect = el.getBoundingClientRect();
    // Expand card rect by asteroid radius so a near-miss still counts
    const l = rect.left - radius;
    const r = rect.right + radius;
    const t = rect.top - radius;
    const b = rect.bottom + radius;

    // Compute t ∈ [0,1] where asteroid center is inside the expanded rect
    // Horizontal band [l, r]
    let t0x = 0;
    let t1x = 1;
    if (Math.abs(dx) > 0.5) {
      const ta = (l - startX) / dx;
      const tb = (r - startX) / dx;
      t0x = Math.max(0, Math.min(ta, tb));
      t1x = Math.min(1, Math.max(ta, tb));
    } else if (startX < l || startX > r) {
      continue; // vertical path misses horizontally
    }

    // Vertical band [t, b]
    let t0y = 0;
    let t1y = 1;
    if (Math.abs(dy) > 0.5) {
      const ta = (t - startY) / dy;
      const tb = (b - startY) / dy;
      t0y = Math.max(0, Math.min(ta, tb));
      t1y = Math.min(1, Math.max(ta, tb));
    } else if (startY < t || startY > b) {
      continue; // horizontal path misses vertically
    }

    const tEnter = Math.max(t0x, t0y);
    const tLeave = Math.min(t1x, t1y);
    if (tEnter <= tLeave && tEnter <= 1 && tLeave >= 0) {
      hits.push({ cardId, hitTimeMs: Math.round(tEnter * durationMs) });
    }
  }

  return hits.sort((a, b) => a.hitTimeMs - b.hitTimeMs);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

export const CARD_PHYSICS_CSS = `
  /* Impact flash — played once, attribute removed after animation */
  [data-card-physics-impact] {
    animation: cpImpact 0.55s ease-out both !important;
  }
  /* Shake — played once after impact */
  [data-card-physics-shaking] {
    animation: cpShake 0.6s cubic-bezier(0.36,0.07,0.19,0.97) both !important;
  }
  /* Persistent damage — crack glow, slight desaturation */
  [data-card-physics-damaged] {
    box-shadow:
      inset 0 0 0 2px rgba(239,68,68,0.45),
      0 0 8px 0 rgba(251,146,60,0.3) !important;
    filter: brightness(0.94) saturate(0.75) !important;
    transition: box-shadow 0.2s, filter 0.2s;
  }
  /* Collapse animation — plays while falling off screen */
  [data-card-physics-collapsing] {
    animation: cpCollapse 1.15s cubic-bezier(0.4,0,0.6,1) forwards !important;
    pointer-events: none !important;
    transform-origin: center bottom !important;
    position: relative !important;
    z-index: 50 !important;
  }
  /* Final fallen state — card is invisible but still occupies layout space */
  [data-card-physics-fallen] {
    visibility: hidden !important;
    pointer-events: none !important;
  }

  @keyframes cpImpact {
    0%   { transform: scale(1);    box-shadow: 0 0 0 0px rgba(251,146,60,0);   filter: brightness(1); }
    20%  { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(251,146,60,0.8); filter: brightness(1.4); }
    42%  { transform: scale(0.97); box-shadow: 0 0 0 4px rgba(239,68,68,0.5);  filter: brightness(1.15); }
    64%  { transform: scale(1.01); box-shadow: none; }
    100% { transform: scale(1);    box-shadow: none;                            filter: brightness(1); }
  }
  @keyframes cpShake {
    0%,100% { transform: translateX(0)   rotate(0deg); }
    14%     { transform: translateX(-9px) rotate(-2.5deg); }
    28%     { transform: translateX(8px)  rotate(2deg); }
    42%     { transform: translateX(-6px) rotate(-1.5deg); }
    57%     { transform: translateX(5px)  rotate(1deg); }
    71%     { transform: translateX(-3px); }
    85%     { transform: translateX(3px); }
  }
  @keyframes cpCollapse {
    0%   { transform: scaleX(1)    scaleY(1)    translateY(0)     rotate(0deg);  opacity: 1; }
    10%  { transform: scaleX(1.08) scaleY(0.88) translateY(5px)   rotate(0deg);  opacity: 1; }
    20%  { transform: scaleX(0.93) scaleY(0.72) translateY(22px)  rotate(2.5deg); opacity: 0.95; }
    38%  { transform: scaleX(0.88) scaleY(0.55) translateY(58px)  rotate(5deg);  opacity: 0.8; }
    60%  { transform: scaleX(0.75) scaleY(0.32) translateY(105px) rotate(9deg);  opacity: 0.45; }
    100% { transform: scaleX(0.55) scaleY(0.08) translateY(140vh) rotate(14deg); opacity: 0; }
  }
`;
