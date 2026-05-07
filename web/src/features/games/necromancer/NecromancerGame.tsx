"use client";
// web/src/features/games/necromancer/NecromancerGame.tsx
//
// Renderer and interaction layer for the top-down necromancer overlay.
//
// This file is deliberately written to let the live customer page remain visible
// under the battlefield. The game should read like the current page has "turned
// into" a battlefield instead of a boxed minigame sitting on top of it.
//
// Mount strategy:
// - Snapshot customer-card positions once on open.
// - Render a transparent fixed overlay and a canvas battlefield.
// - Do not mutate customer DOM, layout, or card contents after mount.
//
// Interaction model:
// - Click soldier to select. Shift-click adds/removes from selection.
// - Left-click ground to place a move target for the selection, or the full squad if nothing is selected.
// - Click a dead ghost while a revive charge exists to bring that unit back.
// - Right-click calls down a lightning smite at the cursor.
// - Upgrades are only available between waves.

import React from "react";
import { getEnemySpec } from "./enemies/catalog";
import {
  buildCost,
  type CombatEffect,
  type CombatProjectile,
  PATH_DEFS,
  PATH_LEVEL_COSTS,
  RISE_DURATION,
  SMITE_COOLDOWN_SECONDS,
  effectiveStats,
  initNecromancer,
  queueBuildCommand,
  queueClearTargetCommand,
  queueMoveCommand,
  queueReviveCommand,
  queueSmiteCommand,
  queueTowerMountCommand,
  queueUpgrade,
  setTimeScale,
  startNextWave,
  tickNecromancer,
  togglePause,
  type BuildableKind,
  type Enemy,
  type NecromancerCustomer,
  type NecromancerState,
  type Soldier,
  type Structure,
  type UpgradeBranch,
  type UpgradePath,
} from "./NecromancerEngine";
import {
  drawEffectAvatar,
  drawEnemyAvatar,
  drawProjectileAvatar,
  drawSoldierAvatar,
  drawStructureAvatar,
} from "./visuals";

export function scanCustomersFromDOM(): NecromancerCustomer[] {
  try {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-card-physics-id][data-block-name]"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          id: element.dataset.cardPhysicsId ?? element.dataset.blockId ?? String(Math.random()),
          name: (element.dataset.blockName ?? "").slice(0, 18),
          isActive: element.dataset.customerActive !== "false",
          cardX: rect.left + rect.width / 2,
          cardY: rect.top + rect.height / 2,
        };
      })
      .filter((customer) => customer.cardX > 0 && customer.cardY > 0);
  } catch {
    return [];
  }
}

type Props = {
  customers: NecromancerCustomer[];
  onEnd: () => void;
};

type HitResult =
  | { kind: "soldier"; soldierUid: number }
  | { kind: "enemy"; enemyUid: number }
  | { kind: "ghost"; soldierUid: number }
  | { kind: "structure"; structureUid: number }
  | { kind: "field"; x: number; y: number };

const OVERLAY_ACCENT = "rgba(96, 165, 250, 0.18)";
const SELECTION_COLOR = "#fde68a";
const BUILD_LABELS: Record<BuildableKind, { title: string; detail: string }> = {
  wall: { title: "Wall", detail: "Hold lanes" },
  tower: { title: "Tower", detail: "Ranger perch" },
  spikeTrap: { title: "Spikes", detail: "Melee punish" },
  blastTrap: { title: "Blast Sigil", detail: "Burst pack" },
};

export default function NecromancerGame({ customers, onEnd }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const stateRef = React.useRef<NecromancerState | null>(null);
  const rafRef = React.useRef<number>(0);
  const lastFrameRef = React.useRef<number>(0);
  const pointerRef = React.useRef({ x: 0, y: 0 });
  const selectedUidsRef = React.useRef<number[]>([]);
  const buildModeRef = React.useRef<BuildableKind | null>(null);
  const wallRotationRef = React.useRef<number>(0);

  const [selectedUids, setSelectedUids] = React.useState<number[]>([]);
  const [, setTick] = React.useState(0);
  const [showHelp, setShowHelp] = React.useState(false);
  const [buildMode, setBuildMode] = React.useState<BuildableKind | null>(null);
  const [wallRotation, setWallRotation] = React.useState(0);
  const [gameInfoCollapsed, setGameInfoCollapsed] = React.useState(false);
  const unitCardDrag = useDrag(() => ({ x: window.innerWidth - 300, y: 80 }));

  React.useEffect(() => {
    selectedUidsRef.current = selectedUids;
  }, [selectedUids]);

  React.useEffect(() => { buildModeRef.current = buildMode; }, [buildMode]);
  React.useEffect(() => { wallRotationRef.current = wallRotation; }, [wallRotation]);

  // Reset draggable unit card to default position whenever the selection changes to a new soldier.
  const prevSingleUidRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const uid = selectedUids.length === 1 ? selectedUids[0] : null;
    if (uid !== null && uid !== prevSingleUidRef.current) {
      unitCardDrag.setPos({ x: window.innerWidth - 300, y: 80 });
    }
    prevSingleUidRef.current = uid;
  }, [selectedUids, unitCardDrag]);

  // While the game is mounted, keep customer cards hidden so soldiers stand
  // in their place rather than the DOM cards bleeding through the canvas.
  React.useEffect(() => {
    document.body.dataset.necroActive = "true";
    return () => { delete document.body.dataset.necroActive; };
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    syncSize();
    stateRef.current = initNecromancer(customers, canvas.width, canvas.height);
    lastFrameRef.current = performance.now();

    function frame(now: number) {
      const state = stateRef.current;
      if (!state) return;

      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = now;
      tickNecromancer(state, dt);

      const context = canvas.getContext("2d");
      if (context) drawFrame(context, state, pointerRef.current, selectedUidsRef.current, buildModeRef.current, wallRotationRef.current);

      if (Math.floor(now / 80) !== Math.floor((now - dt * 1000) / 80)) {
        setTick((current) => current + 1);
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    window.addEventListener("resize", syncSize);
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", syncSize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [customers]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "q") {
        event.preventDefault();
        onEnd();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedUids([]);
        setShowHelp(false);
      }
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        const currentState = stateRef.current;
        if (currentState) { togglePause(currentState); setTick((c) => c + 1); }
      }
      if (event.key.toLowerCase() === "v") {
        const currentState = stateRef.current;
        if (!currentState || !selectedUids.length) return;
        const ghost = currentState.soldiers.find((soldier) => selectedUids.includes(soldier.uid) && soldier.dead);
        if (ghost) queueReviveCommand(currentState, ghost.uid);
      }
      // Arrow keys rotate wall placement
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const delta = event.key === "ArrowLeft" ? -Math.PI / 8 : Math.PI / 8;
        setWallRotation((current) => current + delta);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEnd, selectedUids]);

  const state = stateRef.current;
  const singleSelectedSoldier =
    state && selectedUids.length === 1
      ? state.soldiers.find((soldier) => soldier.uid === selectedUids[0]) || null
      : null;

  const handlePointerMove = React.useCallback((event: React.MouseEvent) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleCanvasClick = React.useCallback(
    (event: React.MouseEvent) => {
      const currentState = stateRef.current;
      if (!currentState) return;

      const hit = resolveHit(currentState, event.clientX, event.clientY);

      if (buildMode && currentState.phase === "planning" && hit.kind === "field") {
        queueBuildCommand(currentState, buildMode, hit.x, hit.y, buildMode === "wall" ? wallRotation : 0);
        setTick((current) => current + 1);
        return;
      }

      if (hit.kind === "ghost") {
        queueReviveCommand(currentState, hit.soldierUid);
        setSelectedUids([hit.soldierUid]);
        return;
      }

      if (hit.kind === "soldier") {
        setSelectedUids((current) => {
          if (!event.shiftKey) return [hit.soldierUid];
          return current.includes(hit.soldierUid)
            ? current.filter((uid) => uid !== hit.soldierUid)
            : [...current, hit.soldierUid];
        });
        return;
      }

      if (hit.kind === "structure") {
        const structure = currentState.structures.find((candidate) => candidate.uid === hit.structureUid && !candidate.dead) || null;
        if (structure?.kind === "tower" && selectedUids.length === 1) {
          const ranger = currentState.soldiers.find((soldier) => soldier.uid === selectedUids[0] && !soldier.dead) || null;
          if (ranger?.path === "ranger") {
            queueTowerMountCommand(currentState, ranger.uid, structure.uid);
            setTick((current) => current + 1);
            return;
          }
        }
      }

      const moveTarget =
        hit.kind === "enemy"
          ? { x: currentState.enemies.find((enemy) => enemy.uid === hit.enemyUid)?.x ?? event.clientX, y: currentState.enemies.find((enemy) => enemy.uid === hit.enemyUid)?.y ?? event.clientY }
          : { x: hit.x, y: hit.y };

      const movingUids = selectedUids.length
        ? selectedUids
        : currentState.soldiers.filter((soldier) => !soldier.dead).map((soldier) => soldier.uid);

      if (movingUids.length) {
        queueMoveCommand(currentState, movingUids, moveTarget.x, moveTarget.y);
      }
    },
    [buildMode, wallRotation, selectedUids],
  );

  const handleCanvasContextMenu = React.useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    const currentState = stateRef.current;
    if (!currentState) return;
    queueSmiteCommand(currentState, event.clientX, event.clientY);
  }, []);

  const handleClearTargets = React.useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState || !selectedUids.length) return;
    queueClearTargetCommand(currentState, selectedUids);
  }, [selectedUids]);

  const handleRestart = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    stateRef.current = initNecromancer(customers, canvas.width, canvas.height);
    setSelectedUids([]);
    setShowHelp(false);
    setBuildMode(null);
    setWallRotation(0);
    setTick((c) => c + 1);
  }, [customers]);

  const handleTogglePause = React.useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState) return;
    togglePause(currentState);
    setTick((c) => c + 1);
  }, []);

  const handleToggleSpeed = React.useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState) return;
    setTimeScale(currentState, currentState.timeScale === 1 ? 2 : 1);
    setTick((c) => c + 1);
  }, []);

  const handleUpgrade = React.useCallback(
    (choice: UpgradePath | UpgradeBranch, soldier: Soldier) => {
      const currentState = stateRef.current;
      if (!currentState) return;
      if (!soldier.path) {
        queueUpgrade(currentState, { kind: "choose-path", soldierUid: soldier.uid, path: choice as UpgradePath });
      } else {
        queueUpgrade(currentState, { kind: "upgrade-branch", soldierUid: soldier.uid, branch: choice as UpgradeBranch });
      }
      setTick((current) => current + 1);
    },
    [],
  );

  const handleStartWave = React.useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState) return;
    startNextWave(currentState);
    setTick((current) => current + 1);
  }, []);

  return (
    <div className="fixed inset-0 z-[9998]">
      {/* Hide customer cards while the game is active — soldiers stand in their place. */}
      <style>{`
        body[data-necro-active] [data-card-physics-id] {
          opacity: 0 !important;
          pointer-events: none !important;
          transition: opacity 0.6s ease !important;
        }
      `}</style>
      <canvas
        ref={canvasRef}
        onMouseMove={handlePointerMove}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
        style={{ display: "block", width: "100%", height: "100%", cursor: selectedUids.length ? "crosshair" : "default" }}
      />

      {state && (
        <>
          <GameInfoPanel
            state={state}
            collapsed={gameInfoCollapsed}
            buildMode={buildMode}
            wallRotation={wallRotation}
            onToggleCollapse={() => setGameInfoCollapsed((current) => !current)}
            onExit={onEnd}
            onToggleHelp={() => setShowHelp((current) => !current)}
            onRestart={handleRestart}
            onStartWave={handleStartWave}
            onBuildModeChange={setBuildMode}
            onTogglePause={handleTogglePause}
            onToggleSpeed={handleToggleSpeed}
          />
          {singleSelectedSoldier && (
            <DraggableUnitCard
              soldier={singleSelectedSoldier}
              gold={state.gold}
              canUpgrade={state.phase === "planning" && !singleSelectedSoldier.dead}
              pos={unitCardDrag.pos}
              onDragStart={unitCardDrag.handleDragStart}
              onClose={() => setSelectedUids([])}
              onUpgrade={handleUpgrade}
              onClearTarget={handleClearTargets}
            />
          )}
          <EndOverlay state={state} onRestart={handleRestart} />
        </>
      )}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function resolveHit(state: NecromancerState, x: number, y: number): HitResult {
  const livingSoldier = state.soldiers.find((soldier) => !soldier.dead && distanceTo(x, y, soldier.x, soldier.y) < 18);
  if (livingSoldier) return { kind: "soldier", soldierUid: livingSoldier.uid };

  const enemy = state.enemies.find((candidate) => !candidate.dead && distanceTo(x, y, candidate.x, candidate.y) < 20);
  if (enemy) return { kind: "enemy", enemyUid: enemy.uid };

  const structure = state.structures.find((candidate) => !candidate.dead && distanceTo(x, y, candidate.x, candidate.y) < candidate.radius + 6);
  if (structure) return { kind: "structure", structureUid: structure.uid };

  const ghost = state.soldiers.find(
    (soldier) => soldier.dead && soldier.deathTimer < 18 && distanceTo(x, y, soldier.x, soldier.y) < 22,
  );
  if (ghost) return { kind: "ghost", soldierUid: ghost.uid };

  return {
    kind: "field",
    x: clamp(x, state.bounds.left, state.bounds.right),
    y: clamp(y, state.bounds.top, state.bounds.bottom),
  };
}

const BUILD_ICONS: Record<BuildableKind, React.ReactNode> = {
  wall: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 14 Q10 4 18 14" strokeLinecap="round" />
    </svg>
  ),
  tower: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="7" y="6" width="6" height="10" rx="1" />
      <path d="M5 6h10M7 3v3M10 2v4M13 3v3" strokeLinecap="round" />
    </svg>
  ),
  spikeTrap: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 16 L7 8 L10 14 L13 8 L16 16" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  blastTrap: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.5 5.5l1.5 1.5M13 13l1.5 1.5M5.5 14.5l1.5-1.5M13 7l1.5-1.5" strokeLinecap="round" />
    </svg>
  ),
};

function GameInfoPanel({
  state,
  collapsed,
  buildMode,
  wallRotation,
  onToggleCollapse,
  onExit,
  onToggleHelp,
  onRestart,
  onStartWave,
  onBuildModeChange,
  onTogglePause,
  onToggleSpeed,
}: {
  state: NecromancerState;
  collapsed: boolean;
  buildMode: BuildableKind | null;
  wallRotation: number;
  onToggleCollapse: () => void;
  onExit: () => void;
  onToggleHelp: () => void;
  onRestart: () => void;
  onStartWave: () => void;
  onBuildModeChange: React.Dispatch<React.SetStateAction<BuildableKind | null>>;
  onTogglePause: () => void;
  onToggleSpeed: () => void;
}) {
  const isPlanning = state.phase === "planning";
  const smiteProgress = state.smiteCooldownLeft > 0 ? 1 - state.smiteCooldownLeft / SMITE_COOLDOWN_SECONDS : 1;
  const smiteReady = state.smiteCooldownLeft <= 0;

  return (
    <aside
      className="absolute left-5 top-5 z-10 w-[min(300px,calc(100vw-2.5rem))] rounded-3xl border border-white/15 bg-slate-950/72 text-slate-100 shadow-2xl backdrop-blur-md"
      onClick={(event) => event.stopPropagation()}
    >
      {/* Header — always visible */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">Necromancer</div>
          <div className="mt-0.5 text-sm font-semibold">Wave {state.wave} / {formatWaveTotal(state.totalWaves)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-full border border-white/15 p-1.5 text-slate-300 transition hover:bg-white/10"
            title={collapsed ? "Expand" : "Collapse"}
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed ? <path d="M2 4l4 4 4-4" /> : <path d="M2 8l4-4 4 4" />}
            </svg>
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-slate-300 transition hover:bg-white/10"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Always-visible controls section */}
      <div className="px-4 pb-4 pt-3">
        {/* Smite regen bar */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>God Smite</span>
            <span className={smiteReady ? "text-sky-300" : "text-slate-400"}>{smiteReady ? "Ready" : `${formatSeconds(state.smiteCooldownLeft)}s`}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: `${smiteProgress * 100}%` }}
            />
          </div>
        </div>

        {/* Game controls row */}
        <div className="flex gap-1.5">
          {isPlanning ? (
            <button
              type="button"
              onClick={onStartWave}
              className="flex-1 rounded-xl bg-sky-500 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              ▶ Start Wave {state.wave + 1}
            </button>
          ) : (
            <div className="flex-1 rounded-xl border border-white/10 bg-black/20 py-2 text-center text-xs text-slate-400">
              Wave {state.wave}
            </div>
          )}
          <button
            type="button"
            onClick={onTogglePause}
            title="Pause (P)"
            className={`rounded-xl border px-3 py-2 text-xs transition ${state.paused ? "border-amber-400/40 bg-amber-400/15 text-amber-300" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
          >
            {state.paused ? "▶" : "⏸"}
          </button>
          <button
            type="button"
            onClick={onToggleSpeed}
            title="2× speed"
            className={`rounded-xl border px-3 py-2 text-xs transition ${state.timeScale === 2 ? "border-purple-400/40 bg-purple-400/15 text-purple-300" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
          >
            {state.timeScale === 2 ? "2×" : "1×"}
          </button>
        </div>

        {/* Build tools 2×2 grid */}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {(["wall", "tower", "spikeTrap", "blastTrap"] as BuildableKind[]).map((kind) => {
            const cost = buildCost(state, kind);
            const active = buildMode === kind;
            const disabled = !isPlanning;
            return (
              <button
                key={kind}
                type="button"
                disabled={disabled}
                onClick={() => onBuildModeChange((current) => (current === kind ? null : kind))}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-xs transition ${active ? "border-sky-300/60 bg-sky-400/20 text-sky-100" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className={active ? "text-sky-300" : "text-slate-400"}>{BUILD_ICONS[kind]}</span>
                <span>
                  <div className="font-semibold text-white">{BUILD_LABELS[kind].title}</div>
                  <div className="text-[10px] text-slate-400">{cost}g</div>
                </span>
              </button>
            );
          })}
        </div>
        {buildMode === "wall" && (
          <div className="mt-1.5 text-center text-[10px] text-slate-400">← → rotate · {Math.round((wallRotation * 180) / Math.PI)}°</div>
        )}
      </div>

      {/* Expandable info section */}
      {!collapsed && (
        <div className="border-t border-white/8 px-4 pb-4 pt-3">
          <div className="text-xs text-slate-400">{state.waveLabel}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-200">
            <InfoChip label="Gold" value={state.gold} compact />
            <InfoChip label="Revives" value={state.reviveCharges} compact />
            <InfoChip label="Score" value={state.score} compact />
            <InfoChip label="Phase" value={capitalizeLabel(state.phase)} compact />
          </div>
          <button
            type="button"
            onClick={onToggleHelp}
            className="mt-3 w-full rounded-xl border border-white/10 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10"
          >
            Battle Help
          </button>
        </div>
      )}
    </aside>
  );
}


// ---------------------------------------------------------------------------
// useDrag — pointer-draggable panel hook
// ---------------------------------------------------------------------------
function useDrag(defaultPos: () => { x: number; y: number }) {
  const [pos, setPosState] = React.useState(defaultPos);
  const posRef = React.useRef(pos);
  const dragRef = React.useRef({ active: false, startMX: 0, startMY: 0, startX: 0, startY: 0 });

  const setPos = React.useCallback((p: { x: number; y: number }) => {
    posRef.current = p;
    setPosState(p);
  }, []);

  const handleDragStart = React.useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, startMX: e.clientX, startMY: e.clientY, startX: posRef.current.x, startY: posRef.current.y };
    e.preventDefault();
    e.stopPropagation();
  }, []);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const x = dragRef.current.startX + e.clientX - dragRef.current.startMX;
      const y = dragRef.current.startY + e.clientY - dragRef.current.startMY;
      posRef.current = { x, y };
      setPosState({ x, y });
    };
    const onUp = () => { dragRef.current.active = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return { pos, setPos, handleDragStart };
}

// ---------------------------------------------------------------------------
// DraggableUnitCard — floating soldier details panel
// ---------------------------------------------------------------------------
function DraggableUnitCard({
  soldier,
  gold,
  canUpgrade,
  pos,
  onDragStart,
  onClose,
  onUpgrade,
  onClearTarget,
}: {
  soldier: Soldier;
  gold: number;
  canUpgrade: boolean;
  pos: { x: number; y: number };
  onDragStart: (e: React.MouseEvent) => void;
  onClose: () => void;
  onUpgrade: (choice: UpgradePath | UpgradeBranch, soldier: Soldier) => void;
  onClearTarget: () => void;
}) {
  const stats = effectiveStats(soldier);
  const skillState = getSoldierSkillState(soldier);

  return (
    <div
      className="absolute z-20 w-[272px] rounded-[24px] border border-white/15 bg-slate-950/80 shadow-2xl backdrop-blur-md"
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle / header */}
      <div
        className="flex cursor-grab items-center justify-between gap-2 rounded-t-[24px] px-4 py-3 active:cursor-grabbing"
        onMouseDown={onDragStart}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{soldier.name}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {soldier.path ? `${PATH_DEFS[soldier.path].label} · Lv ${soldier.level}` : `Untrained · Lv ${soldier.level}`}
            {soldier.dead && <span className="ml-2 text-amber-300">Ghost</span>}
          </div>
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="shrink-0 rounded-full border border-white/15 p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>

      <div className="border-t border-white/8 px-4 pb-4 pt-3">
        {/* Compact stats row */}
        <div className="flex gap-2 text-[11px] text-slate-300">
          <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">HP {Math.ceil(soldier.hp)}/{soldier.maxHp}</span>
          <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">{skillState.label}: {skillState.value}</span>
          <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">Rng {Math.round(stats.attackRange)}</span>
        </div>

        {/* Upgrade buttons */}
        {canUpgrade && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {!soldier.path
              ? (["warrior", "guardian", "ranger"] as UpgradePath[]).map((path) => {
                  const def = PATH_DEFS[path];
                  const cost = 30;
                  return (
                    <button
                      key={path}
                      type="button"
                      disabled={gold < cost}
                      onClick={() => onUpgrade(path, soldier)}
                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-left text-[11px] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <div className="font-semibold text-white">{def.label}</div>
                      <div className="mt-0.5 text-slate-400">{cost}g</div>
                    </button>
                  );
                })
              : (["primary", "secondary", "special"] as UpgradeBranch[]).map((branch) => {
                  const def = PATH_DEFS[soldier.path!].upgrades[branch];
                  const currentLevel = soldier.upgradeLevels[branch];
                  const cost = currentLevel < PATH_LEVEL_COSTS.length ? PATH_LEVEL_COSTS[currentLevel] : null;
                  return (
                    <button
                      key={branch}
                      type="button"
                      disabled={cost === null || gold < cost}
                      onClick={() => onUpgrade(branch, soldier)}
                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-left text-[11px] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <div className="font-semibold text-white">{def.label}</div>
                      <div className="mt-0.5 text-slate-400">{cost === null ? "Max" : `${cost}g`}</div>
                    </button>
                  );
                })}
          </div>
        )}

        <button
          type="button"
          onClick={onClearTarget}
          className="mt-2 w-full rounded-xl border border-white/10 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10"
        >
          Clear Target
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EndOverlay — defeat/victory overlay, independent of sidebar collapsed state
// ---------------------------------------------------------------------------
function EndOverlay({ state, onRestart }: { state: NecromancerState; onRestart: () => void }) {
  if (state.phase !== "victory" && state.phase !== "defeat") return null;
  const won = state.phase === "victory";
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-sm">
      <div
        className="w-[320px] rounded-[28px] border border-white/15 bg-slate-950/88 p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/75">
          {won ? "Victory" : "Defeat"}
        </div>
        <div className="mt-2 text-3xl font-bold text-white">
          {won ? "The line holds" : "The line has fallen"}
        </div>
        <div className="mt-3 text-sm text-slate-300">
          Score {state.score} · Wave {state.wave} · Gold {state.gold}
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="mt-6 w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

function InfoChip({ label, value, compact = false }: { label: string; value: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-black/20 ${compact ? "px-3 py-2" : "px-3 py-3"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className={`${compact ? "mt-1 text-xs" : "mt-1 text-sm"} font-medium text-slate-100`}>{value}</div>
    </div>
  );
}

function getSoldierSkillState(soldier: Soldier): { label: string; value: string } {
  if (soldier.path === "guardian") {
    return { label: "Taunt", value: soldier.tauntCooldownLeft > 0 ? `${formatSeconds(soldier.tauntCooldownLeft)}s` : "Ready" };
  }
  if (soldier.path === "warrior") {
    return { label: "Charge", value: soldier.chargeCooldownLeft > 0 ? `${formatSeconds(soldier.chargeCooldownLeft)}s` : "Ready" };
  }
  if (soldier.path === "ranger") {
    return { label: "Swift Escape", value: soldier.dodgeCooldownLeft > 0 ? `${formatSeconds(soldier.dodgeCooldownLeft)}s` : "Ready" };
  }
  return { label: "Special", value: "Locked" };
}

function getSoldierPathMode(soldier: Soldier): string {
  if (soldier.mountedStructureUid !== null) return "Tower hold";
  if (soldier.targetEnemyUid !== null) return "Target pursue";
  if (soldier.moveTargetX !== null && soldier.moveTargetY !== null) return "Move order";
  if (soldier.path === "ranger") return "Rear support";
  return "Auto engage";
}


function formatWaveTotal(totalWaves: number): string {
  return Number.isFinite(totalWaves) ? String(totalWaves) : "Infinite";
}

function formatSeconds(value: number): string {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

function capitalizeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[560px] max-w-[92vw] rounded-[28px] border border-white/15 bg-slate-950/82 p-6 text-slate-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/80">Battle Help</div>
            <div className="mt-1 text-2xl font-semibold">Top-down command battlefield</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-slate-300">
          <div>
            <div className="font-semibold text-white">During combat</div>
            <div className="mt-1">Select soldiers, left-click to move them, right-click to smite, and revive ghosts when charges exist. Rangers can be mounted onto towers. ESC deselects. Q exits.</div>
          </div>
          <div>
            <div className="font-semibold text-white">Between waves</div>
            <div className="mt-1">Spend gold on unit paths, place walls, towers, and traps, then start the next wave.</div>
          </div>
          <div>
            <div className="font-semibold text-white">Readability</div>
            <div className="mt-1">Units handle chasing, spacing, range management, and basic formation separation on their own.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function drawFrame(
  context: CanvasRenderingContext2D,
  state: NecromancerState,
  pointer: { x: number; y: number },
  selectedUids: number[],
  buildMode: BuildableKind | null = null,
  wallRotation = 0,
) {
  const { bounds } = state;
  context.clearRect(0, 0, state.W, state.H);

  // Darker battlefield treatment so units stay legible over the live page.
  context.fillStyle = "rgba(2, 6, 12, 0.22)";
  context.fillRect(0, 0, state.W, state.H);
  const vignette = context.createRadialGradient(bounds.centerX, bounds.centerY, 80, bounds.centerX, bounds.centerY, Math.max(state.W, state.H) * 0.62);
  vignette.addColorStop(0, "rgba(8, 15, 28, 0.16)");
  vignette.addColorStop(1, "rgba(2, 6, 12, 0.52)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, state.W, state.H);

  context.save();
  context.strokeStyle = OVERLAY_ACCENT;
  context.lineWidth = 1;
  context.setLineDash([8, 10]);
  context.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
  context.setLineDash([]);

  for (let column = 1; column < 6; column += 1) {
    const x = bounds.left + (bounds.width / 6) * column;
    context.strokeStyle = "rgba(148, 163, 184, 0.12)";
    context.beginPath();
    context.moveTo(x, bounds.top);
    context.lineTo(x, bounds.bottom);
    context.stroke();
  }

  for (let row = 1; row < 4; row += 1) {
    const y = bounds.top + (bounds.height / 4) * row;
    context.beginPath();
    context.moveTo(bounds.left, y);
    context.lineTo(bounds.right, y);
    context.stroke();
  }

  drawMoveTargets(context, state, selectedUids);
  drawSpawnWarnings(context, state);
  drawLightningStrikes(context, state);
  drawProjectiles(context, state.projectiles);


  // 0 at game start → 1 when intro ends (phaseTimer counts down from 1.5)
  const introProgress = state.phase === "intro" ? Math.max(0, 1 - state.phaseTimer / 1.5) : 1;

  for (const structure of state.structures) drawStructure(context, structure);
  for (const enemy of state.enemies) drawEnemy(context, enemy);
  for (const soldier of state.soldiers) drawSoldier(context, soldier, selectedUids.includes(soldier.uid), introProgress);
  drawEffects(context, state.effects);

  // Build placement preview
  if (buildMode && state.phase === "planning") {
    const WALL_RADIUS = 90;
    context.save();
    context.globalAlpha = 0.55;
    if (buildMode === "wall") {
      drawStructureAvatar(context, "wall", pointer.x, pointer.y, WALL_RADIUS, false, wallRotation);
    } else {
      drawStructureAvatar(context, buildMode, pointer.x, pointer.y, 16, false, 0);
    }
    context.restore();
  }

  if (selectedUids.length) {
    context.strokeStyle = "rgba(253, 230, 138, 0.45)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(pointer.x, pointer.y, 16, 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();
}

function drawSpawnWarnings(context: CanvasRenderingContext2D, state: NecromancerState) {
  for (const order of state.spawnQueue.slice(0, 8)) {
    const alpha = Math.max(0.16, Math.min(0.42, 0.42 - order.delay * 0.08));
    context.fillStyle = `rgba(248, 113, 113, ${alpha})`;
    context.beginPath();
    context.arc(order.x, order.y, 10, 0, Math.PI * 2);
    context.fill();
  }
}

function drawMoveTargets(context: CanvasRenderingContext2D, state: NecromancerState, selectedUids: number[]) {
  const orderedSoldiers = state.soldiers.filter((soldier) => !soldier.dead && soldier.moveTargetX !== null && soldier.moveTargetY !== null);
  for (const soldier of orderedSoldiers) {
    const emphasized = !selectedUids.length || selectedUids.includes(soldier.uid);
    context.save();
    context.globalAlpha = emphasized ? 0.92 : 0.35;
    context.strokeStyle = emphasized ? "rgba(125, 211, 252, 0.9)" : "rgba(148, 163, 184, 0.55)";
    context.lineWidth = emphasized ? 1.8 : 1;
    context.beginPath();
    context.arc(soldier.moveTargetX!, soldier.moveTargetY!, emphasized ? 12 : 9, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(soldier.moveTargetX! - 6, soldier.moveTargetY!);
    context.lineTo(soldier.moveTargetX! + 6, soldier.moveTargetY!);
    context.moveTo(soldier.moveTargetX!, soldier.moveTargetY! - 6);
    context.lineTo(soldier.moveTargetX!, soldier.moveTargetY! + 6);
    context.stroke();
    context.restore();
  }
}

function drawLightningStrikes(context: CanvasRenderingContext2D, state: NecromancerState) {
  for (const strike of state.lightningStrikes) {
    const progress = 1 - strike.timer / 0.3;
    const alpha = Math.max(0, 1 - progress);
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = "rgba(191, 219, 254, 0.96)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(strike.x - 10, 0);
    context.lineTo(strike.x + 6, strike.y * 0.32);
    context.lineTo(strike.x - 14, strike.y * 0.58);
    context.lineTo(strike.x + 8, strike.y);
    context.stroke();

    context.globalAlpha = alpha * 0.8;
    context.strokeStyle = "rgba(147, 197, 253, 0.95)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(strike.x, strike.y, strike.radius * (0.34 + progress * 0.66), 0, Math.PI * 2);
    context.stroke();

    context.globalAlpha = alpha * 0.28;
    context.fillStyle = "rgba(248, 250, 252, 0.95)";
    context.beginPath();
    context.arc(strike.x, strike.y, strike.radius * 0.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawProjectiles(context: CanvasRenderingContext2D, projectiles: CombatProjectile[]) {
  for (const projectile of projectiles) {
    const alpha = Math.max(0.16, projectile.timer / Math.max(0.01, projectile.maxTimer));
    context.save();
    context.globalAlpha = alpha * 0.28;
    context.strokeStyle = projectile.kind === "hex" ? "#c084fc" : projectile.kind === "smite" ? "#93c5fd" : "#86efac";
    context.lineWidth = projectile.kind === "smite" ? 4 : 2;
    context.beginPath();
    context.moveTo(projectile.x - projectile.vx * 0.035, projectile.y - projectile.vy * 0.035);
    context.lineTo(projectile.x, projectile.y);
    context.stroke();
    context.restore();

    drawProjectileAvatar(
      context,
      projectile.kind,
      projectile.x,
      projectile.y,
      Math.atan2(projectile.vy, projectile.vx || 0.001),
      projectile.radius,
      alpha,
    );
  }
}

function drawEffects(context: CanvasRenderingContext2D, effects: CombatEffect[]) {
  for (const effect of effects) {
    const progress = 1 - effect.timer / Math.max(0.01, effect.maxTimer);
    drawEffectAvatar(context, effect.kind, effect.x, effect.y, effect.radius, progress, effect.color);
  }
}

function drawStructure(context: CanvasRenderingContext2D, structure: Structure) {
  if (structure.dead) {
    context.save();
    context.globalAlpha = Math.max(0, 0.5 - structure.deathTimer);
    context.fillStyle = "rgba(100, 116, 139, 0.35)";
    context.beginPath();
    context.arc(structure.x, structure.y, structure.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  context.save();
  drawStructureAvatar(context, structure.kind, structure.x, structure.y, structure.radius, structure.ownerSoldierUid !== null, structure.rotation);

  if (structure.maxHp > 1) {
    drawHpBar(context, structure.x - 14, structure.y - structure.radius - 10, 28, 3, structure.hp, structure.maxHp, "rgba(15,23,42,0.85)", "#60a5fa");
  }
  context.restore();
}

function drawSoldier(
  context: CanvasRenderingContext2D,
  soldier: Soldier,
  selected: boolean,
  introProgress = 1,
) {
  const stats = effectiveStats(soldier);
  const color = soldier.path ? PATH_DEFS[soldier.path].color : "#e2e8f0";

  // ── Ghost (dead soldier waiting for revive) ────────────────────────────────
  if (soldier.dead) {
    const ghostAlpha = Math.max(0.12, 1 - soldier.deathTimer / 18);
    context.save();
    context.globalAlpha = ghostAlpha;
    context.strokeStyle = "rgba(196, 181, 253, 0.9)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(soldier.x, soldier.y, 18, 0, Math.PI * 2);
    context.stroke();
    context.font = "12px system-ui";
    context.textAlign = "center";
    context.fillStyle = "#e9d5ff";
    context.fillText("revive", soldier.x, soldier.y - 24);
    context.restore();
    return;
  }

  // ── Compute draw position ──────────────────────────────────────────────────

  // Bob: gentle breathing oscillation, suppressed during rise animation.
  const bobY = soldier.riseTimer <= 0 ? Math.sin(soldier.bobPhase) * 1.8 : 0;

  // Rise-from-below: soldier appears 22 px below its true position and glides up.
  const riseP = soldier.riseTimer > 0 ? Math.max(0, 1 - soldier.riseTimer / RISE_DURATION) : 1;
  const riseDropY = soldier.riseTimer > 0 ? (1 - riseP) * 22 : 0;

  // Lean in facing direction: peaks at riseP≈0.4 (mid-rise) then straightens.
  const leanAmt = soldier.riseTimer > 0
    ? (riseP < 0.4
      ? (riseP / 0.4) * 7
      : riseP < 0.75
      ? ((0.75 - riseP) / 0.35) * 7
      : 0)
    : 0;

  const drawX = soldier.x + soldier.facingX * leanAmt;
  const drawY = soldier.y + bobY + riseDropY;

  // Materialization radius: shrinks from ~10% to full size during intro.
  const matRadius = introProgress < 1 ? Math.max(1, 10 * (0.06 + introProgress * 0.94)) : 10;
  const mounted = soldier.mountedStructureUid !== null;

  context.save();

  // ── Selection ring ─────────────────────────────────────────────────────────
  if (selected) {
    context.strokeStyle = SELECTION_COLOR;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(drawX, drawY, mounted ? 21 : 17, 0, Math.PI * 2);
    context.stroke();
  }

  // ── Undead-rise glow ring + ground shadow ──────────────────────────────────
  if (soldier.riseTimer > 0) {
    // Expanding ring that dissipates as the soldier straightens up
    const riseAlpha = (1 - riseP) * 0.7;
    const riseRingR = 12 + (1 - riseP) * 16;
    context.globalAlpha = riseAlpha;
    context.strokeStyle = "rgba(196, 181, 253, 0.95)";
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(drawX, drawY, riseRingR, 0, Math.PI * 2);
    context.stroke();

    // Dark ground shadow below the rising soldier, shrinks to nothing
    context.globalAlpha = (1 - riseP) * 0.38;
    context.fillStyle = "rgba(15, 5, 30, 0.85)";
    context.beginPath();
    context.arc(soldier.x, soldier.y + 5, (1 - riseP) * 14 + 3, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 1;
  }

  // ── Intro moonlight shimmer: large contracting ring + inner glow ───────────
  if (introProgress < 1) {
    const shimmerA = (1 - introProgress) * 0.72;
    const shimmerR = matRadius + (1 - introProgress) * 38;
    context.globalAlpha = shimmerA;
    context.strokeStyle = "#c4b5fd";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(drawX, drawY, shimmerR, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = shimmerA * 0.32;
    context.fillStyle = "rgba(139, 92, 246, 0.55)";
    context.beginPath();
    context.arc(drawX, drawY, shimmerR * 0.68, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  // ── Soldier body ───────────────────────────────────────────────────────────
  context.globalAlpha = introProgress < 0.15 ? introProgress / 0.15 : 1;
  drawSoldierAvatar(context, soldier, drawX, drawY, mounted ? matRadius * 0.82 : matRadius, color);
  context.globalAlpha = 1;

  // ── Facing direction indicator ─────────────────────────────────────────────
  context.strokeStyle = "rgba(255,255,255,0.22)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(drawX, drawY);
  context.lineTo(drawX + soldier.facingX * 14, drawY + soldier.facingY * 14);
  context.stroke();

  // ── Hit flash ─────────────────────────────────────────────────────────────
  if (soldier.hitFlash !== 0) {
    context.globalAlpha = Math.abs(soldier.hitFlash) * 0.45;
    context.fillStyle = soldier.hitFlash > 0 ? "#f87171" : "#4ade80";
    context.beginPath();
    context.arc(drawX, drawY, 14, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  if (soldier.tauntActiveTimer > 0) {
    context.globalAlpha = Math.min(0.4, soldier.tauntActiveTimer * 0.2);
    context.strokeStyle = "rgba(147, 197, 253, 0.85)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(drawX, drawY, 22 + Math.sin(soldier.bobPhase * 0.7) * 3, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  // ── HP bar + name (fade in during late intro so they don't clutter the spawn) ─
  if (introProgress > 0.55) {
    const labelAlpha = introProgress < 0.82 ? (introProgress - 0.55) / 0.27 : 1;
    context.globalAlpha = labelAlpha;
    drawHpBar(context, drawX - 16, drawY - 22, 32, 4, soldier.hp, soldier.maxHp, "rgba(15,23,42,0.85)", "#4ade80");
    context.font = "10px system-ui";
    context.textAlign = "center";
    context.fillStyle = "rgba(241, 245, 249, 0.92)";
    context.fillText(soldier.name, drawX, drawY + 24);
    context.globalAlpha = 1;
  }

  // ── Ranger range ring ──────────────────────────────────────────────────────
  if (stats.attackRange > 100) {
    context.globalAlpha = 0.1;
    context.strokeStyle = color;
    context.beginPath();
    context.arc(drawX, drawY, stats.attackRange, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  context.restore();
}

function drawEnemy(context: CanvasRenderingContext2D, enemy: Enemy) {
  if (enemy.dead) {
    context.save();
    context.globalAlpha = Math.max(0, 0.6 - enemy.deathTimer);
    context.fillStyle = "rgba(71, 85, 105, 0.55)";
    context.beginPath();
    context.arc(enemy.x, enemy.y, 10, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  const spec = getEnemySpec(enemy.variant);
  const color = spec.color;
  context.save();
  drawEnemyAvatar(context, enemy.variant, enemy.x, enemy.y, spec.radius, color);

  if (spec.boss) {
    context.strokeStyle = "rgba(255, 244, 214, 0.9)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(enemy.x, enemy.y, spec.radius + 4, 0, Math.PI * 2);
    context.stroke();
  }

  if (enemy.hitFlash > 0) {
    context.globalAlpha = enemy.hitFlash * 0.5;
    context.fillStyle = "#fde68a";
    context.beginPath();
    context.arc(enemy.x, enemy.y, 14, 0, Math.PI * 2);
    context.fill();
  }

  drawHpBar(context, enemy.x - 14, enemy.y - 18, 28, 3, enemy.hp, enemy.maxHp, "rgba(15,23,42,0.85)", "#fb7185");
  context.restore();
}

function drawHpBar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  hp: number,
  maxHp: number,
  backColor: string,
  frontColor: string,
) {
  context.fillStyle = backColor;
  context.fillRect(x, y, width, height);
  context.fillStyle = frontColor;
  context.fillRect(x, y, width * Math.max(0, hp / Math.max(1, maxHp)), height);
}

function distanceTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
