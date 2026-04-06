"use client";

import Link from "next/link";
import React from "react";
import { useMe, useUpdateMe } from "@hooks/useUsers";
import { buildHighScoreUpdate, GAME_SCORE_KEYS, getGameHighScore } from "../highScores";
import { markGameActive, shouldHandleGlobalGameKey, usePauseOnHidden } from "../input";

// ---- Types ----
type ObstacleKind = "normal" | "dash" | "shark";

type Obstacle = {
  id: number;
  x: number;
  width: number;
  height: number;
  passed: boolean;
  nearMiss: boolean;
  kind: ObstacleKind;
  color: string;
  speedMultiplier: number;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
  shape: "circle" | "square";
};

type SpeedLine = {
  id: number;
  x: number;
  y: number;
  length: number;
  opacity: number;
};

type BonusItem = {
  id: number;
  x: number;
  y: number;
  baseY: number;
  size: number;
  phase: number;
  amplitude: number;
};

// ---- World constants ----
const WORLD = {
  width: 760,
  height: 220,
  groundHeight: 34,
  dinoX: 56,
  dinoWidth: 30,
  dinoHeight: 34,
  gravity: 0.6,
  jumpVelocity: -11,
  obstacleMinWidth: 12,
  obstacleMaxWidth: 26,
  obstacleMinHeight: 18,
  obstacleMaxHeight: 52,
  baseSpeed: 5.3,
};

const GROUND_TOP = WORLD.height - WORLD.groundHeight;
const JUMP_BUFFER_FRAMES = 8;
const COYOTE_FRAMES = 6;
const HITBOX_INSET_PX = 3;

const PARTICLE_COLORS_DUST = ["#94a3b8", "#cbd5e1", "#64748b"];
const PARTICLE_COLORS_SPARK = ["#f59e0b", "#ef4444", "#ffffff", "#fca5a5"];
const PARTICLE_COLORS_SCORE = ["#f59e0b", "#fbbf24", "#fcd34d"];

let _particleId = 0;
let _speedLineId = 0;
let _bonusId = 0;

// ---- Easter egg theme system ----
type Theme = {
  bg: string;
  ground: string;
  dino: string;
  normal: string;
  dash: string;
  shark: string;
};

const DEFAULT_THEME: Theme = {
  bg: "bg-slate-100",
  ground: "bg-slate-300",
  dino: "bg-slate-900",
  normal: "bg-emerald-700",
  dash: "bg-rose-600",
  shark: "bg-amber-600",
};

function preferredRunnerTheme(): Theme {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return {
      bg: "bg-slate-800",
      ground: "bg-slate-700",
      dino: "bg-slate-100",
      normal: "bg-emerald-400",
      dash: "bg-rose-400",
      shark: "bg-amber-400",
    };
  }
  return DEFAULT_THEME;
}

const COLOR_POOL = [
  "bg-slate-100","bg-slate-200","bg-slate-300","bg-slate-500","bg-slate-600",
  "bg-stone-200","bg-stone-300","bg-zinc-300","bg-zinc-500","bg-gray-500",
  "bg-blue-200","bg-blue-300","bg-blue-500","bg-sky-200","bg-sky-500",
  "bg-teal-200","bg-teal-500","bg-indigo-300","bg-indigo-500","bg-neutral-500",
];

// ---- Helpers ----
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(items: T[]): T { return items[Math.floor(Math.random() * items.length)]; }
function difficultyFromScore(score: number) { return clamp(1 - Math.exp(-score / 28), 0, 1); }
function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makeDistinctTheme(): Theme {
  const [bg, ground, dino, normal, dash, shark] = shuffle(COLOR_POOL).slice(0, 6);
  return { bg, ground, dino, normal, dash, shark };
}
function obstacleBackshiftPx(baseSpeed: number) { return clamp(baseSpeed * 0.85, 5, 11); }

function spawnObstacle(params: { id: number; x: number; score: number; isCluster?: boolean; theme: Theme }): Obstacle {
  const { id, x, score, isCluster, theme } = params;
  const d = difficultyFromScore(score);
  const kindRoll = Math.random();
  const dashChance = lerp(0.05, 0.16, d);
  const sharkChance = lerp(0.05, 0.16, d);
  let kind: ObstacleKind = "normal";
  if (kindRoll < sharkChance) kind = "shark";
  else if (kindRoll < sharkChance + dashChance) kind = "dash";
  if (isCluster && kind === "dash" && Math.random() < 0.6) kind = "normal";
  const color = kind === "dash" ? theme.dash : kind === "shark" ? theme.shark : theme.normal;
  let width = rand(WORLD.obstacleMinWidth, WORLD.obstacleMaxWidth);
  let height = rand(WORLD.obstacleMinHeight, WORLD.obstacleMaxHeight);
  height *= lerp(0.95, 1.22, d);
  width *= lerp(0.95, 1.10, d);
  let speedMultiplier = 1;
  if (kind === "dash") {
    width *= 0.9; height *= 1.02;
    speedMultiplier = lerp(1.10, 1.22, d);
  } else if (kind === "shark") {
    height *= lerp(0.48, 0.62, d); width *= 1.25;
    speedMultiplier = lerp(1.0, 1.10, d);
  }
  if (kind === "normal" && Math.random() < lerp(0.07, 0.14, d)) {
    height *= lerp(1.20, 1.40, d); width *= 0.92;
  }
  return { id, x, width: clamp(width, 10, 34), height: clamp(height, 10, 68), passed: false, nearMiss: false, kind, color, speedMultiplier };
}

function seedSpeedLines(): SpeedLine[] {
  return Array.from({ length: 6 }, () => ({
    id: ++_speedLineId,
    x: rand(60, WORLD.width - 20),
    y: rand(18, GROUND_TOP - 18),
    length: rand(18, 42),
    opacity: rand(0.07, 0.20),
  }));
}

export type RunnerGameProps = {
  embedded?: boolean;
  title?: string;
  onSessionStart?: () => void;
};

// ---- Component ----
export function RunnerGame({ embedded = false, title = "Quick Break", onSessionStart }: RunnerGameProps) {
  const rootRef = React.useRef<HTMLElement | null>(null);
  // Core game state
  const [dinoY, setDinoY] = React.useState(0);
  const [obstacles, setObstacles] = React.useState<Obstacle[]>([]);
  const [running, setRunning] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const [highScore, setHighScore] = React.useState(0);
  const [theme, setTheme] = React.useState<Theme>(() => preferredRunnerTheme());

  // Juice state
  const [particles, setParticles] = React.useState<Particle[]>([]);
  const [speedLines, setSpeedLines] = React.useState<SpeedLine[]>([]);
  const [shakeActive, setShakeActive] = React.useState(false);
  const [isNewBest, setIsNewBest] = React.useState(false);
  const [bonusItem, setBonusItem] = React.useState<BonusItem | null>(null);
  const [groundOffset, setGroundOffset] = React.useState(0);
  const [dinoScale, setDinoScale] = React.useState({ x: 1, y: 1 });

  const { data: me } = useMe();
  const meLite = (me as { extras?: Record<string, unknown> | null } | null) || null;
  const updateMe = useUpdateMe();

  // Core refs
  const velocityRef = React.useRef(0);
  const yRef = React.useRef(0);
  const obstaclesRef = React.useRef<Obstacle[]>([]);
  const speedRef = React.useRef(WORLD.baseSpeed);
  const rafRef = React.useRef<number | null>(null);
  const spawnCooldownPxRef = React.useRef(0);
  const bonusSpawnCooldownPxRef = React.useRef(0);
  const obstacleIdRef = React.useRef(0);
  const runningRef = React.useRef(false);
  const gameOverRef = React.useRef(false);
  const scoreRef = React.useRef(0);
  const canDoubleJumpRef = React.useRef(true);
  const jumpBufferRef = React.useRef(0);
  const coyoteRef = React.useRef(0);
  const clusterRemainingRef = React.useRef(0);
  const clusterSpacingPxRef = React.useRef(0);
  const easterEggArmedRef = React.useRef(false);
  const lastThemeShiftAtScoreRef = React.useRef<number>(-1);

  // Juice refs
  const particlesRef = React.useRef<Particle[]>([]);
  const speedLinesRef = React.useRef<SpeedLine[]>(seedSpeedLines());
  const bonusItemRef = React.useRef<BonusItem | null>(null);
  const shakeFramesRef = React.useRef(0);
  const shakeActiveRef = React.useRef(false);
  const newBestShownRef = React.useRef(false);
  const groundOffsetRef = React.useRef(0);
  const wasOnGroundRef = React.useRef(true);
  const spawnedObsIdsRef = React.useRef<Set<number>>(new Set());

  // Loop-stable mirrors — keep the game loop dep array to [running, performJump]
  // so that highScore/theme/me updates never cancel & restart the RAF mid-game.
  const highScoreRef = React.useRef(highScore);
  highScoreRef.current = highScore;
  const meLiteRef = React.useRef(meLite);
  meLiteRef.current = meLite;
  const persistedHighScoreRef = React.useRef(0); // filled after useMemo below
  const updateMeRef = React.useRef(updateMe);
  updateMeRef.current = updateMe;
  const themeRef = React.useRef(theme);
  themeRef.current = theme;

  // High score persistence
  const persistedHighScore = React.useMemo(() => {
    const legacy = Number((meLite?.extras as Record<string, unknown> | undefined)?.quickBreakHighScore || 0);
    const mapped = getGameHighScore(meLite, GAME_SCORE_KEYS.runner);
    return Math.max(Number.isFinite(legacy) ? legacy : 0, mapped);
  }, [meLite]);
  persistedHighScoreRef.current = persistedHighScore;

  React.useEffect(() => {
    const saved = window.localStorage.getItem("dino_high_score");
    const local = saved ? Number(saved) : 0;
    setHighScore(Math.max(persistedHighScore || 0, Number.isFinite(local) ? local : 0));
    speedLinesRef.current = seedSpeedLines();
    setSpeedLines([...speedLinesRef.current]);
  }, [persistedHighScore]);

  React.useEffect(() => {
    window.localStorage.setItem("dino_high_score", String(highScore || 0));
  }, [highScore]);

  const resetGame = React.useCallback(() => {
    velocityRef.current = 0;
    yRef.current = 0;
    obstaclesRef.current = [];
    speedRef.current = WORLD.baseSpeed;
    spawnCooldownPxRef.current = 220;
    bonusSpawnCooldownPxRef.current = rand(1100, 2200);
    scoreRef.current = 0;
    obstacleIdRef.current = 0;
    gameOverRef.current = false;
    runningRef.current = false;
    canDoubleJumpRef.current = true;
    jumpBufferRef.current = 0;
    coyoteRef.current = 0;
    clusterRemainingRef.current = 0;
    clusterSpacingPxRef.current = 0;
    easterEggArmedRef.current = false;
    lastThemeShiftAtScoreRef.current = -1;

    particlesRef.current = [];
    bonusItemRef.current = null;
    groundOffsetRef.current = 0;
    wasOnGroundRef.current = true;
    shakeFramesRef.current = 0;
    shakeActiveRef.current = false;
    newBestShownRef.current = false;
    spawnedObsIdsRef.current = new Set();
    speedLinesRef.current = seedSpeedLines();

    setTheme(preferredRunnerTheme());
    setDinoY(0);
    setObstacles([]);
    setScore(0);
    setRunning(false);
    setGameOver(false);
    setParticles([]);
    setSpeedLines([...speedLinesRef.current]);
    setShakeActive(false);
    setIsNewBest(false);
    setBonusItem(null);
    setGroundOffset(0);
    setDinoScale({ x: 1, y: 1 });
  }, []);

  const performJump = React.useCallback(() => {
    if (gameOverRef.current) return;
    if (!runningRef.current) { runningRef.current = true; setRunning(true); }
    const onGround = yRef.current <= 0.001;
    const groundedOrCoyote = onGround || coyoteRef.current > 0;
    if (groundedOrCoyote) {
      velocityRef.current = WORLD.jumpVelocity;
      canDoubleJumpRef.current = true;
      coyoteRef.current = 0;
      // Emit takeoff squash signal — handled in loop via velocity
      return;
    }
    if (canDoubleJumpRef.current) {
      canDoubleJumpRef.current = false;
      velocityRef.current = Math.min(velocityRef.current, WORLD.jumpVelocity * 0.9);
    }
  }, []);

  const jump = React.useCallback(() => {
    if (gameOverRef.current) return;
    if (!runningRef.current) { runningRef.current = true; setRunning(true); }
    jumpBufferRef.current = JUMP_BUFFER_FRAMES;
  }, []);

  const restart = React.useCallback(() => {
    onSessionStart?.();
    resetGame();
    runningRef.current = true;
    canDoubleJumpRef.current = true;
    setRunning(true);
  }, [onSessionStart, resetGame]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!shouldHandleGlobalGameKey(rootRef.current, e)) return;
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (gameOverRef.current) { restart(); return; }
        jump();
      } else if (e.code === "Enter" && gameOverRef.current) {
        e.preventDefault();
        restart();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [jump, restart]);

  usePauseOnHidden(() => {
    runningRef.current = false;
    setRunning(false);
  });

  // ---- Main game loop ----
  React.useEffect(() => {
    if (!running) return;

    const frame = () => {
      if (!runningRef.current || gameOverRef.current) return;

      // Physics
      velocityRef.current += WORLD.gravity;
      yRef.current = Math.max(0, yRef.current - velocityRef.current);
      const onGround = yRef.current <= 0.001;

      if (onGround) {
        if (velocityRef.current > 0) velocityRef.current = 0;
        canDoubleJumpRef.current = true;
        coyoteRef.current = COYOTE_FRAMES;
      } else {
        coyoteRef.current = Math.max(0, coyoteRef.current - 1);
      }

      // Landing dust
      const justLanded = !wasOnGroundRef.current && onGround;
      if (justLanded) {
        for (let i = 0; i < 7; i++) {
          const angle = Math.PI + (i / 6) * Math.PI;
          particlesRef.current.push({
            id: ++_particleId,
            x: WORLD.dinoX + WORLD.dinoWidth / 2,
            y: GROUND_TOP,
            vx: Math.cos(angle) * rand(1.2, 3.0),
            vy: Math.sin(angle) * rand(0.8, 2.2) - 0.5,
            life: 1.0,
            decay: rand(0.055, 0.08),
            size: rand(3, 6),
            color: pick(PARTICLE_COLORS_DUST),
            shape: "circle",
          });
        }
      }
      wasOnGroundRef.current = onGround;

      // Squash/stretch
      const vy = velocityRef.current;
      const scaleX = vy < -7 ? lerp(1, 0.84, clamp((-vy - 7) / 4, 0, 1))
                   : vy > 4  ? lerp(1, 1.12, clamp((vy - 4) / 4, 0, 1)) : 1;
      const scaleY = vy < -7 ? lerp(1, 1.18, clamp((-vy - 7) / 4, 0, 1))
                   : vy > 4  ? lerp(1, 0.86, clamp((vy - 4) / 4, 0, 1)) : 1;
      setDinoScale({ x: scaleX, y: scaleY });

      // Buffered input
      if (jumpBufferRef.current > 0) jumpBufferRef.current -= 1;
      if (jumpBufferRef.current > 0) {
        const prevVel = velocityRef.current;
        const prevCanDouble = canDoubleJumpRef.current;
        performJump();
        if (velocityRef.current < prevVel || canDoubleJumpRef.current !== prevCanDouble) {
          jumpBufferRef.current = 0;
        }
      }

      // Difficulty + speed
      const d = difficultyFromScore(scoreRef.current);
      speedRef.current += lerp(0.0025, 0.0060, d);

      // Ground scroll
      groundOffsetRef.current = (groundOffsetRef.current + speedRef.current) % 760;
      setGroundOffset(groundOffsetRef.current);

      // Speed lines
      speedLinesRef.current = speedLinesRef.current.map(line => {
        const nextX = line.x - speedRef.current * 1.5;
        if (nextX + line.length < 0) {
          return {
            id: ++_speedLineId,
            x: WORLD.width + rand(0, 80),
            y: rand(18, GROUND_TOP - 18),
            length: rand(18, 42),
            opacity: rand(0.07, 0.20),
          };
        }
        return { ...line, x: nextX };
      });
      setSpeedLines([...speedLinesRef.current]);

      // Spawn obstacles
      spawnCooldownPxRef.current -= speedRef.current;
      if (spawnCooldownPxRef.current <= 0) {
        obstacleIdRef.current += 1;
        const isCluster = clusterRemainingRef.current > 0;
        const newObstacle = spawnObstacle({ id: obstacleIdRef.current, x: WORLD.width + 6, score: scoreRef.current, isCluster, theme: themeRef.current });
        obstaclesRef.current = [...obstaclesRef.current, newObstacle];

        if (!isCluster) {
          if (Math.random() < lerp(0.06, 0.16, d)) {
            clusterRemainingRef.current = 1;
            clusterSpacingPxRef.current = lerp(150, 120, d);
          }
        } else {
          clusterRemainingRef.current = 0;
        }

        const worstCaseSpeed = speedRef.current * 1.22;
        const minGapPx = lerp(190, 155, d);
        const baseGapPx = rand(lerp(320, 240, d), lerp(440, 300, d));
        const dashPaddingPx = newObstacle.kind === "dash" ? lerp(60, 90, d) : 0;
        const reactionPaddingPx = clamp(worstCaseSpeed * lerp(14, 18, d), 80, 220);

        if (clusterRemainingRef.current > 0) {
          spawnCooldownPxRef.current = Math.max(minGapPx, clusterSpacingPxRef.current);
        } else {
          spawnCooldownPxRef.current = Math.max(minGapPx, baseGapPx + dashPaddingPx + reactionPaddingPx);
          if (Math.random() < lerp(0.05, 0.02, d)) spawnCooldownPxRef.current += 110;
        }
      }

      // Spawn rare floating bonus
      bonusSpawnCooldownPxRef.current -= speedRef.current;
      if (!bonusItemRef.current && bonusSpawnCooldownPxRef.current <= 0) {
        if (Math.random() < 0.28) {
          const baseY = rand(58, GROUND_TOP - 64);
          bonusItemRef.current = {
            id: ++_bonusId,
            x: WORLD.width + 12,
            y: baseY,
            baseY,
            size: rand(12, 16),
            phase: rand(0, Math.PI * 2),
            amplitude: rand(8, 16),
          };
        }
        bonusSpawnCooldownPxRef.current = rand(1500, 3200);
      }

      // Move obstacles + score
      let nextScore = scoreRef.current;
      const moved: Obstacle[] = [];

      for (const obstacle of obstaclesRef.current) {
        const moveSpeed = speedRef.current * obstacle.speedMultiplier;
        const nextObstacle = { ...obstacle, x: obstacle.x - moveSpeed };

        if (!nextObstacle.passed && nextObstacle.x + nextObstacle.width < WORLD.dinoX) {
          nextObstacle.passed = true;
          nextScore += 1;

          // Near-miss feedback only when this obstacle was actually close.
          if (nextObstacle.nearMiss) {
            shakeFramesRef.current = 10;
            // Spark burst
            for (let i = 0; i < 10; i++) {
              particlesRef.current.push({
                id: ++_particleId,
                x: WORLD.dinoX + WORLD.dinoWidth,
                y: GROUND_TOP - yRef.current - WORLD.dinoHeight / 2,
                vx: rand(-0.5, 3.0),
                vy: rand(-2.8, 2.8),
                life: 1.0,
                decay: rand(0.04, 0.07),
                size: rand(3, 7),
                color: pick(PARTICLE_COLORS_SPARK),
                shape: pick(["circle", "square"]),
              });
            }
          }

          // Score sparks
          for (let i = 0; i < 3; i++) {
            particlesRef.current.push({
              id: ++_particleId,
              x: WORLD.dinoX + WORLD.dinoWidth / 2 + rand(-6, 6),
              y: GROUND_TOP - yRef.current - WORLD.dinoHeight,
              vx: rand(-1.2, 1.2),
              vy: rand(-2.2, -0.6),
              life: 1.0,
              decay: rand(0.07, 0.10),
              size: rand(2, 4),
              color: pick(PARTICLE_COLORS_SCORE),
              shape: "square",
            });
          }
        }

        // Near-miss arm: obstacle approaching dino closely
        if (!nextObstacle.passed) {
          const obstacleTailToDino = (nextObstacle.x + nextObstacle.width) - WORLD.dinoX;
          const obstacleTop = GROUND_TOP - nextObstacle.height;
          const dinoFeet = GROUND_TOP - yRef.current;
          const verticalClearance = obstacleTop - dinoFeet;
          const isNearHorizontally = obstacleTailToDino > 0 && obstacleTailToDino < 24;
          const isNearVertically = verticalClearance >= 0 && verticalClearance < 13;
          if (!nextObstacle.nearMiss && isNearHorizontally && isNearVertically) {
            nextObstacle.nearMiss = true;
          }
        }

        if (nextObstacle.x + nextObstacle.width > -40) moved.push(nextObstacle);
      }

      // Easter egg
      if (!easterEggArmedRef.current && nextScore >= 100) {
        easterEggArmedRef.current = true;
        lastThemeShiftAtScoreRef.current = nextScore;
        setTheme(makeDistinctTheme());
      } else if (easterEggArmedRef.current && nextScore >= 110 && nextScore % 10 === 0) {
        if (lastThemeShiftAtScoreRef.current !== nextScore) {
          lastThemeShiftAtScoreRef.current = nextScore;
          setTheme(makeDistinctTheme());
        }
      }

      // New best detection (in-session)
      if (nextScore !== scoreRef.current) {
        if (nextScore > highScoreRef.current && highScoreRef.current > 0 && !newBestShownRef.current) {
          newBestShownRef.current = true;
          setIsNewBest(true);
        }
      }

      // Shake countdown
      if (shakeFramesRef.current > 0) {
        shakeFramesRef.current -= 1;
        if (!shakeActiveRef.current) {
          shakeActiveRef.current = true;
          setShakeActive(true);
        }
      } else if (shakeActiveRef.current) {
        shakeActiveRef.current = false;
        setShakeActive(false);
      }

      // Particle tick
      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.15, life: p.life - p.decay }))
        .filter(p => p.life > 0 && p.x > -10 && p.x < WORLD.width + 10);

      // Dino hitbox
      const renderDinoTop = Math.round(GROUND_TOP - yRef.current - WORLD.dinoHeight);
      const renderDinoBottom = renderDinoTop + WORLD.dinoHeight;
      const dinoBox = {
        left: WORLD.dinoX + HITBOX_INSET_PX,
        right: WORLD.dinoX + WORLD.dinoWidth - HITBOX_INSET_PX,
        top: renderDinoTop + HITBOX_INSET_PX,
        bottom: renderDinoBottom - HITBOX_INSET_PX,
      };
      const backshift = obstacleBackshiftPx(speedRef.current);

      // Bonus movement + collision
      if (bonusItemRef.current) {
        const nextBonus = { ...bonusItemRef.current };
        nextBonus.x -= speedRef.current * 0.92;
        nextBonus.phase += 0.1;
        nextBonus.y = nextBonus.baseY + Math.sin(nextBonus.phase) * nextBonus.amplitude;

        const bonusBox = {
          left: nextBonus.x,
          right: nextBonus.x + nextBonus.size,
          top: nextBonus.y,
          bottom: nextBonus.y + nextBonus.size,
        };
        const bonusHit =
          dinoBox.left < bonusBox.right &&
          dinoBox.right > bonusBox.left &&
          dinoBox.top < bonusBox.bottom &&
          dinoBox.bottom > bonusBox.top;

        if (bonusHit) {
          nextScore += 10;
          for (let i = 0; i < 10; i++) {
            particlesRef.current.push({
              id: ++_particleId,
              x: nextBonus.x + nextBonus.size / 2,
              y: nextBonus.y + nextBonus.size / 2,
              vx: rand(-2.4, 2.4),
              vy: rand(-2.8, 1.2),
              life: 1.0,
              decay: rand(0.05, 0.09),
              size: rand(2.5, 5.5),
              color: pick(PARTICLE_COLORS_SCORE),
              shape: pick(["circle", "square"]),
            });
          }
          bonusItemRef.current = null;
        } else if (nextBonus.x + nextBonus.size < -20) {
          bonusItemRef.current = null;
        } else {
          bonusItemRef.current = nextBonus;
        }
      }

      // Collision check
      for (const obstacle of moved) {
        const renderX = Math.round(obstacle.x);
        const renderW = Math.round(obstacle.width);
        const renderH = Math.round(obstacle.height);
        const obstacleLeft = renderX - backshift;
        const obstacleBox = {
          left: obstacleLeft + HITBOX_INSET_PX,
          right: obstacleLeft + renderW - HITBOX_INSET_PX,
          top: GROUND_TOP - renderH + HITBOX_INSET_PX,
          bottom: GROUND_TOP - HITBOX_INSET_PX,
        };
        const intersects =
          dinoBox.left < obstacleBox.right &&
          dinoBox.right > obstacleBox.left &&
          dinoBox.top < obstacleBox.bottom &&
          dinoBox.bottom > obstacleBox.top;

        if (intersects) {
          gameOverRef.current = true;
          runningRef.current = false;
          setGameOver(true);
          setRunning(false);

          // Death explosion
          for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2;
            particlesRef.current.push({
              id: ++_particleId,
              x: WORLD.dinoX + WORLD.dinoWidth / 2,
              y: GROUND_TOP - yRef.current - WORLD.dinoHeight / 2,
              vx: Math.cos(angle) * rand(2, 5.5),
              vy: Math.sin(angle) * rand(2, 5.5) - 1,
              life: 1.0,
              decay: rand(0.020, 0.040),
              size: rand(4, 10),
              color: pick(PARTICLE_COLORS_SPARK),
              shape: pick(["circle", "square"]),
            });
          }
          setParticles([...particlesRef.current]);

          // Drain death particles after game stops
          let deathFrames = 0;
          const drain = () => {
            deathFrames++;
            particlesRef.current = particlesRef.current
              .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.15, life: p.life - p.decay }))
              .filter(p => p.life > 0);
            setParticles([...particlesRef.current]);
            if (particlesRef.current.length > 0 && deathFrames < 90) requestAnimationFrame(drain);
          };
          requestAnimationFrame(drain);

          const newHigh = Math.max(highScoreRef.current, nextScore);
          if (newHigh !== highScoreRef.current) {
            setHighScore(newHigh);
            setIsNewBest(true);
            if ((persistedHighScoreRef.current || 0) < newHigh) {
              const patch = buildHighScoreUpdate(meLiteRef.current, GAME_SCORE_KEYS.runner, newHigh);
              if (patch) updateMeRef.current.mutate(patch);
            }
          }
          return;
        }
      }

      if (nextScore !== scoreRef.current) {
        scoreRef.current = nextScore;
        setScore(nextScore);
      }

      obstaclesRef.current = moved;
      setDinoY(yRef.current);
      setObstacles(moved);
      setBonusItem(bonusItemRef.current);
      setParticles([...particlesRef.current]);

      rafRef.current = window.requestAnimationFrame(frame);
    };

    rafRef.current = window.requestAnimationFrame(frame);
    return () => { if (rafRef.current) window.cancelAnimationFrame(rafRef.current); };
  // Deps are intentionally minimal: loop-stable mirrors (refs) replace highScore/
  // theme/meLite/updateMe so RAF is never cancelled mid-game by those changing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, performJump]);

  React.useEffect(() => {
    return () => { if (rafRef.current) window.cancelAnimationFrame(rafRef.current); };
  }, []);

  // ---- Render ----
  return (
    <section
      ref={rootRef}
      data-game-instance="runner"
      tabIndex={0}
      className={embedded ? "w-full" : "h-full w-full flex items-center justify-center p-4 sm:p-6"}
      onPointerDown={(e) => {
        e.currentTarget.focus();
        markGameActive(e.currentTarget);
      }}
      onFocus={(e) => markGameActive(e.currentTarget)}
    >
      <style>{`
        @keyframes dinoShake {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          15%      { transform: translate(-4px,2px) rotate(-0.6deg); }
          30%      { transform: translate(4px,-2px) rotate(0.6deg); }
          48%      { transform: translate(-3px,1px) rotate(-0.3deg); }
          65%      { transform: translate(3px,-1px) rotate(0.3deg); }
          80%      { transform: translate(-1px,0); }
        }
        .dino-shake { animation: dinoShake 180ms ease-out; }

        @keyframes newBestPop {
          0%   { opacity:0; transform:scale(0.4) translateY(-8px); }
          18%  { opacity:1; transform:scale(1.1) translateY(2px); }
          70%  { opacity:1; transform:scale(1) translateY(0); }
          100% { opacity:0; transform:scale(0.9) translateY(-6px); }
        }
        .dino-newbest { animation: newBestPop 2200ms ease-in-out forwards; pointer-events:none; }

        @keyframes obsSpawn {
          0%   { opacity:0.25; transform:scaleY(0.6); transform-origin:bottom; }
          100% { opacity:1;    transform:scaleY(1);   transform-origin:bottom; }
        }
        .dino-obs-spawn { animation: obsSpawn 180ms ease-out forwards; }

        @keyframes closeBadge {
          0%,100% { opacity:0; }
          20%,80% { opacity:1; }
        }
        .dino-close { animation: closeBadge 200ms ease-out; }
      `}</style>

      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">{title}</h1>
          <div className="flex items-center gap-2">
            {!embedded ? <Link href="/customers" className="btn btn-secondary">Go to Caseload Tracker</Link> : null}
            <button type="button" className="btn btn-primary" onClick={gameOver ? restart : jump}>
              {gameOver ? "Restart" : running ? "Jump" : "Start"}
            </button>
          </div>
        </div>

        {/* Game canvas */}
        <div
          role="application"
          aria-label="Dinosaur runner mini game"
          className={`relative w-full overflow-hidden rounded-xl border border-slate-300 ${theme.bg}${shakeActive ? " dino-shake" : ""}`}
          style={{ maxWidth: `${WORLD.width}px`, height: `${WORLD.height}px` }}
          onPointerDown={() => { if (gameOver) { restart(); return; } jump(); }}
        >
          {/* HUD */}
          <div className="absolute left-3 top-2 z-10 flex items-center gap-3 text-xs select-none">
            <span className="text-slate-600 dark:text-slate-300" style={{ fontVariantNumeric: "tabular-nums" }}>
              Score:{" "}
              <span style={{
                fontWeight: 700,
                fontSize: score >= 100 ? "14px" : "12px",
                color: score >= 100 ? "#f59e0b" : "#1e293b",
                transition: "font-size 0.15s, color 0.15s",
              }}>
                {score}
              </span>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500 dark:text-slate-400" style={{ fontVariantNumeric: "tabular-nums" }}>
              Best: <span style={{ fontWeight: 700 }}>{highScore}</span>
            </span>
          </div>

          {/* Speed lines (behind everything) */}
          {running && speedLines.map(line => (
            <div
              key={line.id}
              style={{
                position: "absolute",
                left: `${Math.round(line.x)}px`,
                top: `${Math.round(line.y)}px`,
                width: `${Math.round(line.length)}px`,
                height: "1px",
                backgroundColor: "#94a3b8",
                opacity: line.opacity,
                borderRadius: "1px",
                pointerEvents: "none",
              }}
            />
          ))}

          {/* Ground */}
          <div
            className={`absolute left-0 w-full ${theme.ground}`}
            style={{ top: `${GROUND_TOP}px`, height: `${WORLD.groundHeight}px` }}
          >
            {Array.from({ length: 14 }, (_, i) => {
              const xPos = ((i * 60 - groundOffset % 60) + 60) % 760;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${xPos}px`,
                    top: "7px",
                    width: "2px",
                    height: "9px",
                    opacity: 0.18,
                    backgroundColor: "#000",
                    borderRadius: "1px",
                  }}
                />
              );
            })}
          </div>

          {/* Dino shadow (only when airborne) */}
          {dinoY > 3 && (
            <div
              style={{
                position: "absolute",
                left: `${WORLD.dinoX + 5}px`,
                width: `${WORLD.dinoWidth - 10}px`,
                height: "4px",
                top: `${GROUND_TOP - 2}px`,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.14)",
                transform: `scaleX(${Math.max(0.15, 1 - dinoY / 150)})`,
                opacity: Math.max(0, 1 - dinoY / 170),
                pointerEvents: "none",
              }}
            />
          )}

          {/* Dino — fixed at ground position, GPU-translated upward while airborne */}
          <div
            className={`absolute rounded-sm ${theme.dino}`}
            style={{
              left: `${WORLD.dinoX}px`,
              width: `${WORLD.dinoWidth}px`,
              height: `${WORLD.dinoHeight}px`,
              top: `${GROUND_TOP - WORLD.dinoHeight}px`,
              transform: `translateY(${(-dinoY).toFixed(2)}px) scaleX(${dinoScale.x.toFixed(3)}) scaleY(${dinoScale.y.toFixed(3)})`,
              transformOrigin: "center bottom",
              willChange: "transform",
            }}
          />

          {/* Obstacles — fixed top/size, GPU-translated horizontally */}
          {obstacles.map(obstacle => {
            const isNew = !spawnedObsIdsRef.current.has(obstacle.id);
            if (isNew) spawnedObsIdsRef.current.add(obstacle.id);
            return (
              <div
                key={obstacle.id}
                className={`absolute ${obstacle.color}${isNew ? " dino-obs-spawn" : ""}`}
                style={{
                  left: 0,
                  width: `${Math.round(obstacle.width)}px`,
                  height: `${Math.round(obstacle.height)}px`,
                  top: `${Math.round(GROUND_TOP - obstacle.height)}px`,
                  transform: `translateX(${obstacle.x.toFixed(2)}px)`,
                  borderRadius: obstacle.kind === "shark" ? "3px 3px 0 0" : "2px 2px 0 0",
                  willChange: "transform",
                }}
              />
            );
          })}

          {/* Floating +10 pickup */}
          {bonusItem && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: `${Math.round(bonusItem.size)}px`,
                height: `${Math.round(bonusItem.size)}px`,
                transform: `translate(${bonusItem.x.toFixed(2)}px, ${bonusItem.y.toFixed(2)}px)`,
                borderRadius: "999px",
                background: "radial-gradient(circle at 30% 30%, #fde68a 0%, #f59e0b 60%, #b45309 100%)",
                boxShadow: "0 0 10px rgba(245,158,11,0.45)",
                pointerEvents: "none",
                willChange: "transform",
              }}
            />
          )}

          {/* Particles */}
          {particles.map(p => (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: `${Math.round(p.x - p.size / 2)}px`,
                top: `${Math.round(p.y - p.size / 2)}px`,
                width: `${Math.round(p.size)}px`,
                height: `${Math.round(p.size)}px`,
                borderRadius: p.shape === "circle" ? "50%" : "2px",
                backgroundColor: p.color,
                opacity: Math.max(0, p.life),
                pointerEvents: "none",
              }}
            />
          ))}

          {/* Near-miss "CLOSE!" badge */}
          {shakeActive && (
            <div
              className="dino-close"
              style={{
                position: "absolute",
                left: `${WORLD.dinoX + WORLD.dinoWidth + 8}px`,
                top: `${GROUND_TOP - 52}px`,
                fontSize: "10px",
                fontWeight: 800,
                color: "#ef4444",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                pointerEvents: "none",
              }}
            >
              CLOSE!
            </div>
          )}

          {/* New best banner */}
          {isNewBest && gameOver && (
            <div
              className="dino-newbest"
              style={{
                position: "absolute",
                top: "9px",
                right: "12px",
                fontSize: "11px",
                fontWeight: 800,
                color: "#f59e0b",
                textShadow: "0 1px 4px rgba(0,0,0,0.35)",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
              }}
            >
              🏆 New Best!
            </div>
          )}

          {/* Start overlay */}
          {!running && !gameOver && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.74)", backdropFilter: "blur(1px)" }}
            >
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Ready to run?</p>
              <p style={{ fontSize: "11px", color: "#64748b" }}>Space · ↑ · Tap to start</p>
            </div>
          )}

          {/* Game over overlay */}
          {gameOver && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.72) 100%)" }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.96)",
                  borderRadius: "14px",
                  padding: "16px 28px",
                  textAlign: "center",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Game Over
                </div>
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#475569" }}>
                  Score: <span style={{ fontWeight: 700, color: "#1e293b" }}>{score}</span>
                  {score > 0 && score >= highScore && (
                    <span style={{ marginLeft: "8px", color: "#f59e0b", fontWeight: 700 }}>✨ Personal best!</span>
                  )}
                </div>
                <div style={{ marginTop: "10px", fontSize: "10px", color: "#94a3b8", letterSpacing: "0.04em" }}>
                  SPACE · ENTER · TAP TO RESTART
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Space / ↑ to jump · double-jump enabled · tap on mobile
        </p>
      </div>
    </section>
  );
}

export default RunnerGame;

