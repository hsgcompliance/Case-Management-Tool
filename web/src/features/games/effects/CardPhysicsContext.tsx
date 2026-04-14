"use client";
// web/src/features/games/effects/CardPhysicsContext.tsx
// Context + provider for the card-physics engine.
//
// Cards register by adding  data-card-physics-id={id}  to their root element.
// No import from the games feature is required in card components — the engine
// locates cards via DOM query and drives them purely through data attributes and
// the injected CSS keyframes.
//
// Lifecycle per card:
//   normal  →(hit)→  damaged  →(hit)→  falling  →(1.15s)→  fallen
//   any state →(resetCard)→  normal
//   fallen auto-resets after FALLEN_RESET_MS (10 min)

import React from "react";
import { useAuth } from "@app/auth/AuthProvider";
import {
  CARD_PHYSICS_CSS,
  CARD_PHYSICS_HP,
  FALLEN_RESET_MS,
  type CardPhysicsRecord,
  loadCardPhysics,
  saveCardPhysics,
} from "./cardPhysicsEngine";

// ─── Context value ────────────────────────────────────────────────────────────

export interface CardPhysicsContextValue {
  /** Apply one hit to a card — flash + shake; collapses on the second hit */
  hitCard: (cardId: string) => void;
  /** Immediately start the collapse + fall animation */
  collapseCard: (cardId: string) => void;
  /** Clear all physics state and attributes for a card */
  resetCard: (cardId: string) => void;
  /** Read persisted record for a card (null if untouched) */
  getCardRecord: (cardId: string) => CardPhysicsRecord | null;
}

const CardPhysicsCtx = React.createContext<CardPhysicsContextValue | null>(null);

/** Returns null when called outside a CardPhysicsProvider (games disabled). */
export function useCardPhysics(): CardPhysicsContextValue | null {
  return React.useContext(CardPhysicsCtx);
}

// ─── DOM helpers (module-level, no captures) ──────────────────────────────────

function getEl(cardId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-card-physics-id="${cardId}"]`,
  );
}

function clearPhysicsAttrs(el: HTMLElement) {
  el.removeAttribute("data-card-physics-impact");
  el.removeAttribute("data-card-physics-shaking");
  el.removeAttribute("data-card-physics-damaged");
  el.removeAttribute("data-card-physics-collapsing");
  el.removeAttribute("data-card-physics-fallen");
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function CardPhysicsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const uid = user?.uid ?? "anon";

  const [records, setRecords] = React.useState<Record<string, CardPhysicsRecord>>(
    () => (typeof window !== "undefined" ? loadCardPhysics(uid) : {}),
  );

  // Stable ref so callbacks can read current records without re-creating
  const recordsRef = React.useRef(records);
  React.useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  // Reload from localStorage when the logged-in user changes
  React.useEffect(() => {
    setRecords(loadCardPhysics(uid));
  }, [uid]);

  // Persist whenever records change
  React.useEffect(() => {
    saveCardPhysics(uid, records);
  }, [uid, records]);

  // Inject the CSS keyframes once
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("card-physics-css")) return;
    const style = document.createElement("style");
    style.id = "card-physics-css";
    style.textContent = CARD_PHYSICS_CSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  // Re-apply persistent DOM attrs after renders (handles page nav + virtual lists)
  React.useEffect(() => {
    const now = Date.now();
    for (const [cardId, rec] of Object.entries(records)) {
      if (rec.state !== "fallen") continue;

      // Auto-reset expired fallen cards
      if (rec.fallenAt && now - rec.fallenAt > FALLEN_RESET_MS) {
        setRecords((prev) => {
          const next = { ...prev };
          delete next[cardId];
          return next;
        });
        const el = getEl(cardId);
        if (el) clearPhysicsAttrs(el);
        continue;
      }

      // Restore fallen attribute so newly mounted cards look right
      const el = getEl(cardId);
      if (el && !el.hasAttribute("data-card-physics-fallen")) {
        el.setAttribute("data-card-physics-fallen", "");
      }
    }
  }, [records]);

  // ── collapseCard ─────────────────────────────────────────────────────────
  const collapseCard = React.useCallback((cardId: string) => {
    const el = getEl(cardId);
    if (el) {
      clearPhysicsAttrs(el);
      el.setAttribute("data-card-physics-collapsing", "");
      // After animation finishes, swap to the static "fallen" attr
      setTimeout(() => {
        el.removeAttribute("data-card-physics-collapsing");
        el.setAttribute("data-card-physics-fallen", "");
      }, 1_200);
    }
    setRecords((prev) => {
      const rec = prev[cardId] ?? {
        id: cardId,
        state: "falling" as const,
        hp: 0,
      };
      return {
        ...prev,
        [cardId]: { ...rec, state: "fallen", hp: 0, fallenAt: Date.now() },
      };
    });
  }, []);

  // Ref so hitCard can reference collapseCard without a circular dep
  const collapseCardRef = React.useRef(collapseCard);
  React.useEffect(() => {
    collapseCardRef.current = collapseCard;
  }, [collapseCard]);

  // ── hitCard ───────────────────────────────────────────────────────────────
  const hitCard = React.useCallback((cardId: string) => {
    const rec = recordsRef.current[cardId] ?? {
      id: cardId,
      state: "normal" as const,
      hp: CARD_PHYSICS_HP,
    };
    // Ignore already-falling/fallen cards
    if (rec.state === "falling" || rec.state === "fallen") return;

    const newHp = rec.hp - 1;
    const el = getEl(cardId);

    // Play impact flash immediately
    if (el) {
      el.removeAttribute("data-card-physics-impact");
      // Force reflow so re-adding the attribute restarts the animation
      void el.offsetWidth;
      el.setAttribute("data-card-physics-impact", "");
      setTimeout(() => el.removeAttribute("data-card-physics-impact"), 580);
    }

    if (newHp <= 0) {
      // Mark as falling right away so repeated hits don't stack
      setRecords((prev) => ({
        ...prev,
        [cardId]: { id: cardId, state: "falling", hp: 0 },
      }));
      // Shake, then collapse
      if (el) {
        setTimeout(() => {
          el.setAttribute("data-card-physics-shaking", "");
          setTimeout(() => el.removeAttribute("data-card-physics-shaking"), 650);
        }, 80);
      }
      setTimeout(() => collapseCardRef.current(cardId), 700);
    } else {
      // Shake + apply persistent damage styling
      if (el) {
        setTimeout(() => {
          el.setAttribute("data-card-physics-shaking", "");
          setTimeout(() => el.removeAttribute("data-card-physics-shaking"), 650);
        }, 80);
        setTimeout(() => el.setAttribute("data-card-physics-damaged", ""), 120);
      }
      setRecords((prev) => ({
        ...prev,
        [cardId]: { id: cardId, state: "damaged", hp: newHp },
      }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── resetCard ─────────────────────────────────────────────────────────────
  const resetCard = React.useCallback((cardId: string) => {
    const el = getEl(cardId);
    if (el) clearPhysicsAttrs(el);
    setRecords((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  }, []);

  // ── getCardRecord ─────────────────────────────────────────────────────────
  const getCardRecord = React.useCallback(
    (cardId: string): CardPhysicsRecord | null =>
      recordsRef.current[cardId] ?? null,
    [],
  );

  const value = React.useMemo<CardPhysicsContextValue>(
    () => ({ hitCard, collapseCard, resetCard, getCardRecord }),
    [hitCard, collapseCard, resetCard, getCardRecord],
  );

  return (
    <CardPhysicsCtx.Provider value={value}>{children}</CardPhysicsCtx.Provider>
  );
}
