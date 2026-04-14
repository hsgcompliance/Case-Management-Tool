"use client";
// web/src/features/games/BugGameCanvas.tsx
// Full-viewport canvas renderer + RAF loop + keyboard input.
// Receives initial platforms, runs the game loop internally.

import React from "react";
import {
  tick,
  initGame,
  PLAYER_W,
  PLAYER_H,
  BALL_RADIUS,
  type GameState,
  type Platform,
  type Ladder,
  type Ball,
  type Player,
  type Boss,
} from "./GameEngine";

interface Props {
  platforms: Platform[];
  onEnd: () => void;
}

export default function BugGameCanvas({ platforms, onEnd }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const stateRef = React.useRef<GameState>(initGame(platforms, 1, 0));
  const keysRef = React.useRef<Set<string>>(new Set());
  const rafRef = React.useRef<number>(0);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Resize canvas to viewport
    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Keyboard
    function onKeyDown(e: KeyboardEvent) {
      keysRef.current.add(e.key);
      if (e.key === "Escape" || e.key === "q" || e.key === "Q") {
        onEnd();
        return;
      }
      if ((e.key === "r" || e.key === "R") && stateRef.current.phase === "gameover") {
        stateRef.current = initGame(platforms, 1, 0);
        return;
      }
      // Prevent page scroll during game
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) {
        e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // RAF loop
    function frame() {
      const state = stateRef.current;
      if (state.phase !== "gameover") {
        stateRef.current = tick(state, keysRef.current);
      }
      draw(ctx, stateRef.current);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [platforms, onEnd]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        cursor: "none",
        display: "block",
      }}
    />
  );
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

function draw(ctx: CanvasRenderingContext2D, state: GameState) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Dark overlay (semi-transparent so cards visible below)
  ctx.fillStyle = "rgba(8, 12, 32, 0.82)";
  ctx.fillRect(0, 0, W, H);

  drawPlatforms(ctx, state.platforms);
  drawLadders(ctx, state.ladders);
  drawBalls(ctx, state.balls);
  drawBoss(ctx, state.boss, state.tick);
  drawPlayer(ctx, state.player, state.tick);
  drawHUD(ctx, state, W);

  if (state.phase === "levelwin") drawLevelWin(ctx, state, W, H);
  if (state.phase === "gameover") drawGameOver(ctx, state, W, H);
}

// ── Platforms ──────────────────────────────────────────────────────────────

function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[]) {
  for (const p of platforms) {
    ctx.save();
    if (p.phantom) {
      ctx.setLineDash([8, 5]);
      ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
      ctx.lineWidth = 2;
    } else {
      ctx.setLineDash([]);
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(99, 102, 241, 0.55)";
      ctx.strokeStyle = "rgba(129, 140, 248, 0.9)";
      ctx.lineWidth = 2;
    }
    // Filled card background (very subtle)
    ctx.fillStyle = p.phantom
      ? "rgba(30, 35, 80, 0.3)"
      : "rgba(30, 35, 80, 0.55)";
    const r = 12;
    roundRect(ctx, p.x, p.y, p.width, p.height, r);
    ctx.fill();
    roundRect(ctx, p.x, p.y, p.width, p.height, r);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ladders ────────────────────────────────────────────────────────────────

function drawLadders(ctx: CanvasRenderingContext2D, ladders: Ladder[]) {
  for (const l of ladders) {
    const railOffset = 8;
    const rungSpacing = 14;
    const topY = l.topY;
    const bottomY = l.bottomY;

    ctx.save();
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    // Left rail
    ctx.beginPath();
    ctx.moveTo(l.x - railOffset, topY);
    ctx.lineTo(l.x - railOffset, bottomY);
    ctx.stroke();

    // Right rail
    ctx.beginPath();
    ctx.moveTo(l.x + railOffset, topY);
    ctx.lineTo(l.x + railOffset, bottomY);
    ctx.stroke();

    // Rungs
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#b45309";
    const rungs = Math.floor((bottomY - topY) / rungSpacing);
    for (let i = 1; i <= rungs; i++) {
      const ry = topY + i * rungSpacing;
      ctx.beginPath();
      ctx.moveTo(l.x - railOffset, ry);
      ctx.lineTo(l.x + railOffset, ry);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Balls ──────────────────────────────────────────────────────────────────

function drawBalls(ctx: CanvasRenderingContext2D, balls: Ball[]) {
  for (const b of balls) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);

    // Shadow
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(0,0,0,0.5)";

    // Base ball
    const grd = ctx.createRadialGradient(-3, -3, 1, 0, 0, b.radius);
    grd.addColorStop(0, "#fcd34d");
    grd.addColorStop(0.5, "#d97706");
    grd.addColorStop(1, "#92400e");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();

    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(-3, -3, b.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Boss (bug) ──────────────────────────────────────────────────────────────

function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss, tick: number) {
  ctx.save();

  const shake = boss.animPhase === "wind"
    ? (Math.sin(tick * 0.8) * 4)
    : 0;
  const scale = boss.animPhase === "throw" ? 1.25 : 1;

  ctx.translate(boss.x + 20 + shake, boss.y + 18);
  ctx.scale(scale, scale);

  // Glow around boss
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(220,40,40,0.7)";

  // Draw bug body
  // Abdomen (big oval)
  ctx.fillStyle = "#1a1a0a";
  ctx.beginPath();
  ctx.ellipse(0, 6, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing covers (elytra)
  ctx.fillStyle = "#3d2b05";
  ctx.beginPath();
  ctx.ellipse(-6, 2, 8, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, 2, 8, 14, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = "#2d1f00";
  ctx.beginPath();
  ctx.ellipse(0, -14, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (red)
  ctx.fillStyle = "#ef4444";
  ctx.shadowBlur = 6;
  ctx.shadowColor = "#ef4444";
  ctx.beginPath();
  ctx.arc(-4, -16, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4, -16, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Antennae
  ctx.strokeStyle = "#78716c";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-3, -19);
  ctx.quadraticCurveTo(-12, -30, -16, -28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, -19);
  ctx.quadraticCurveTo(12, -30, 16, -28);
  ctx.stroke();

  // Legs (3 pairs, wavy animation)
  const legWave = Math.sin(tick * 0.15) * 4;
  ctx.strokeStyle = "#4a4030";
  ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    const ly = i * 7;
    const legEnd = 16 + (i === 0 ? 0 : Math.abs(i) * legWave);
    ctx.beginPath();
    ctx.moveTo(-13, ly);
    ctx.lineTo(-legEnd, ly + legWave * i);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(13, ly);
    ctx.lineTo(legEnd, ly + legWave * i);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Player ──────────────────────────────────────────────────────────────────

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, tick: number) {
  if (player.state === "dead") return;
  // Blink when invincible
  if (player.invincibleFrames > 0 && Math.floor(player.invincibleFrames / 4) % 2 === 0) return;

  ctx.save();
  ctx.translate(player.x + PLAYER_W / 2, player.y);

  if (player.facing === -1) ctx.scale(-1, 1);

  const f = player.animFrame;
  const climbing = player.state === "climbing";

  // Shadow
  ctx.shadowBlur = 6;
  ctx.shadowColor = "rgba(99,102,241,0.7)";

  // Legs
  const legPhase = Math.sin(f * Math.PI / 4);
  ctx.fillStyle = "#1e293b";
  if (climbing) {
    ctx.fillRect(-4, 14, 4, 10);
    ctx.fillRect(1, 14, 4, 10);
  } else {
    // Left leg
    ctx.fillRect(-5, 14, 4, 10 + legPhase * 3);
    // Right leg
    ctx.fillRect(1, 14, 4, 10 - legPhase * 3);
  }

  // Body
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(-5, 6, 10, 10);

  // Arms
  const armPhase = climbing ? Math.sin(tick * 0.2) * 3 : legPhase * 2;
  ctx.fillStyle = "#60a5fa";
  ctx.fillRect(-9, 7 + armPhase, 4, 6);
  ctx.fillRect(5, 7 - armPhase, 4, 6);

  // Head
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(0, 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(1, 1, 2, 2);

  // Hat
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-5, -4, 10, 4);
  ctx.fillRect(-3, -8, 6, 4);

  ctx.restore();
}

// ── HUD ─────────────────────────────────────────────────────────────────────

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, W: number) {
  ctx.save();
  ctx.font = "bold 14px 'Courier New', monospace";
  ctx.textBaseline = "top";

  // Lives (top-left)
  ctx.fillStyle = "#ef4444";
  ctx.shadowBlur = 6;
  ctx.shadowColor = "#ef4444";
  const hearts = "♥".repeat(state.player.lives) + "♡".repeat(Math.max(0, 3 - state.player.lives));
  ctx.fillText(hearts, 16, 14);

  // Level + Score (top-right)
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "#fde68a";
  const levelText = `LVL ${state.level}`;
  const scoreText = `${state.score.toLocaleString()}`;
  ctx.textAlign = "right";
  ctx.fillText(levelText, W - 16, 14);
  ctx.fillStyle = "#94a3b8";
  ctx.shadowBlur = 0;
  ctx.fillText(scoreText, W - 16, 32);

  // Controls hint (bottom center) — only show first 5 seconds
  if (state.tick < 300) {
    ctx.fillStyle = "rgba(148,163,184,0.6)";
    ctx.font = "11px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.shadowBlur = 0;
    ctx.fillText("← → move   ↑↓ climb   Space jump   Q / Esc quit", W / 2, ctx.canvas.height - 26);
  }

  ctx.restore();
}

// ── Overlays ────────────────────────────────────────────────────────────────

function drawLevelWin(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const alpha = Math.min(1, (LEVEL_WIN_FRAMES - state.levelWinFrames + 10) / 20);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.55 * alpha})`;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#fbbf24";
  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 48px 'Courier New', monospace";
  ctx.fillText("LEVEL COMPLETE!", W / 2, H / 2 - 30);
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "18px 'Courier New', monospace";
  ctx.fillText(`+${500 + state.level * 100} BONUS   Preparing Level ${state.level + 1}...`, W / 2, H / 2 + 20);
  ctx.restore();
}

// Need LEVEL_WIN_FRAMES const accessible here — import from engine:
const LEVEL_WIN_FRAMES = 100;

function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.shadowBlur = 25;
  ctx.shadowColor = "#ef4444";
  ctx.fillStyle = "#f87171";
  ctx.font = "bold 56px 'Courier New', monospace";
  ctx.fillText("GAME OVER", W / 2, H / 2 - 50);

  ctx.shadowColor = "#fde68a";
  ctx.fillStyle = "#fde68a";
  ctx.font = "22px 'Courier New', monospace";
  ctx.fillText(`SCORE: ${state.score.toLocaleString()}`, W / 2, H / 2 + 10);

  ctx.fillStyle = "#94a3b8";
  ctx.shadowBlur = 0;
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillText("[R] Restart   [Q / Esc] Quit", W / 2, H / 2 + 48);
  ctx.restore();
}

// ── Util ────────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
