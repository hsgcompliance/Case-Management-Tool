import type { BuildableKind, Soldier } from "./NecromancerEngine";
import type { EnemyVariant } from "./enemies/catalog";

export type ProjectileKind = "arrow" | "hex" | "bone" | "smite";
export type EffectKind =
  | "hit"
  | "whirlwind"
  | "guard"
  | "dodge"
  | "smite"
  | "taunt"
  | "spike"
  | "blast";

export function drawSoldierAvatar(
  context: CanvasRenderingContext2D,
  soldier: Soldier,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  context.save();

  const angle = Math.atan2(soldier.facingY, soldier.facingX || 0.001);
  const bodyGradient = context.createRadialGradient(x - radius * 0.35, y - radius * 0.45, radius * 0.15, x, y, radius * 1.15);
  bodyGradient.addColorStop(0, "rgba(255,255,255,0.24)");
  bodyGradient.addColorStop(1, color);

  context.fillStyle = "rgba(2, 6, 23, 0.34)";
  context.beginPath();
  context.ellipse(x, y + radius * 0.92, radius * 0.95, radius * 0.42, 0, 0, Math.PI * 2);
  context.fill();

  context.translate(x, y);
  context.rotate(angle);

  context.fillStyle = bodyGradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(10, 14, 24, 0.88)";
  context.beginPath();
  context.arc(0, -radius * 0.18, radius * 0.42, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.18)";
  context.lineWidth = 1.25;
  context.beginPath();
  context.arc(0, 0, radius, -Math.PI * 0.8, Math.PI * 0.15);
  context.stroke();

  if (soldier.path === "warrior") {
    context.strokeStyle = "#fed7aa";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(radius * 0.2, -radius * 0.1);
    context.lineTo(radius * 1.25, -radius * 0.72);
    context.stroke();
    context.fillStyle = "#f59e0b";
    context.fillRect(radius * 0.96, -radius * 0.92, radius * 0.24, radius * 0.34);
  } else if (soldier.path === "guardian") {
    context.fillStyle = "rgba(191, 219, 254, 0.9)";
    context.beginPath();
    context.moveTo(radius * 0.15, -radius * 0.7);
    context.lineTo(radius * 1.05, -radius * 0.32);
    context.lineTo(radius * 0.88, radius * 0.58);
    context.lineTo(radius * 0.05, radius * 0.32);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(37, 99, 235, 0.88)";
    context.lineWidth = 1.2;
    context.stroke();
  } else if (soldier.path === "ranger") {
    context.strokeStyle = "#86efac";
    context.lineWidth = 1.8;
    context.beginPath();
    context.arc(radius * 0.32, -radius * 0.1, radius * 0.72, -1.2, 1.1);
    context.stroke();
    context.beginPath();
    context.moveTo(-radius * 0.08, -radius * 0.18);
    context.lineTo(radius * 0.92, radius * 0.68);
    context.stroke();
  } else {
    context.fillStyle = "rgba(226, 232, 240, 0.9)";
    context.beginPath();
    context.arc(radius * 0.5, -radius * 0.12, radius * 0.2, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

export function drawEnemyAvatar(
  context: CanvasRenderingContext2D,
  variant: EnemyVariant,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  context.save();

  context.fillStyle = "rgba(2, 6, 23, 0.3)";
  context.beginPath();
  context.ellipse(x, y + radius * 0.95, radius * 0.96, radius * 0.42, 0, 0, Math.PI * 2);
  context.fill();

  context.translate(x, y);

  if (variant === "raider") {
    drawSkull(context, radius, color, true);
  } else if (variant === "hexer") {
    drawSkull(context, radius, color, false);
    context.fillStyle = "rgba(76, 29, 149, 0.72)";
    context.beginPath();
    context.moveTo(-radius * 0.82, -radius * 0.2);
    context.lineTo(0, -radius * 1.35);
    context.lineTo(radius * 0.82, -radius * 0.2);
    context.closePath();
    context.fill();
  } else if (variant === "stalker") {
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(0, 0, radius * 0.68, radius * 0.92, 0.3, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#fdba74";
    context.lineWidth = 1.6;
    context.beginPath();
    context.moveTo(radius * 0.2, -radius * 0.28);
    context.lineTo(radius * 1.15, -radius * 0.9);
    context.stroke();
  } else if (variant === "brute" || variant === "crusher") {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(-radius * 0.8, -radius * 0.9, radius * 1.6, radius * 1.8, radius * 0.42);
    context.fill();
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(-radius * 0.45, -radius * 0.2, radius * 0.9, radius * 0.26);
    if (variant === "crusher") {
      context.strokeStyle = "#fecaca";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-radius * 0.86, -radius * 0.56);
      context.lineTo(radius * 0.86, radius * 0.56);
      context.moveTo(radius * 0.86, -radius * 0.56);
      context.lineTo(-radius * 0.86, radius * 0.56);
      context.stroke();
    }
  } else if (variant === "warlord") {
    drawSkull(context, radius, color, false);
    context.fillStyle = "rgba(120, 53, 15, 0.86)";
    context.beginPath();
    context.moveTo(-radius * 1.05, -radius * 0.12);
    context.lineTo(0, -radius * 1.28);
    context.lineTo(radius * 1.05, -radius * 0.12);
    context.closePath();
    context.fill();
  } else if (variant === "lich") {
    context.fillStyle = "rgba(30, 41, 59, 0.94)";
    context.beginPath();
    context.arc(0, -radius * 0.18, radius * 0.72, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(-radius * 0.92, radius * 0.2);
    context.lineTo(0, -radius * 1.18);
    context.lineTo(radius * 0.92, radius * 0.2);
    context.lineTo(radius * 0.46, radius * 1.02);
    context.lineTo(-radius * 0.46, radius * 1.02);
    context.closePath();
    context.fill();
    context.fillStyle = "#ede9fe";
    context.beginPath();
    context.arc(-radius * 0.2, -radius * 0.14, radius * 0.09, 0, Math.PI * 2);
    context.arc(radius * 0.2, -radius * 0.14, radius * 0.09, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(-radius * 0.9, -radius * 1.02, radius * 1.8, radius * 2.04, radius * 0.46);
    context.fill();
    context.fillStyle = "rgba(255,255,255,0.14)";
    context.beginPath();
    context.arc(0, -radius * 0.1, radius * 0.3, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawSkull(context: CanvasRenderingContext2D, radius: number, color: string, horns: boolean): void {
  context.fillStyle = color;
  context.beginPath();
  context.arc(0, -radius * 0.08, radius * 0.78, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(15, 23, 42, 0.92)";
  context.beginPath();
  context.arc(-radius * 0.2, -radius * 0.14, radius * 0.12, 0, Math.PI * 2);
  context.arc(radius * 0.2, -radius * 0.14, radius * 0.12, 0, Math.PI * 2);
  context.fill();
  context.fillRect(-radius * 0.14, radius * 0.24, radius * 0.28, radius * 0.2);

  if (horns) {
    context.strokeStyle = "#e2e8f0";
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(-radius * 0.56, -radius * 0.42);
    context.lineTo(-radius * 1.02, -radius * 0.98);
    context.moveTo(radius * 0.56, -radius * 0.42);
    context.lineTo(radius * 1.02, -radius * 0.98);
    context.stroke();
  }
}

export function drawStructureAvatar(
  context: CanvasRenderingContext2D,
  kind: BuildableKind,
  x: number,
  y: number,
  radius: number,
  occupied: boolean,
  rotation = 0,
): void {
  context.save();

  if (kind === "wall") {
    // Semi-circle arc facing in rotation direction (open side faces down)
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    const wallThick = 8;
    const rOuter = radius;
    const rInner = radius - wallThick;
    // Draw a thick semi-circle using a path: outer arc → inner arc reversed
    context.beginPath();
    context.arc(0, 0, rOuter, Math.PI, 0, false);     // top outer arc L→R
    context.lineTo(rInner, 0);
    context.arc(0, 0, rInner, 0, Math.PI, true);      // inner arc R→L
    context.closePath();
    const grad = context.createLinearGradient(0, -rOuter, 0, 0);
    grad.addColorStop(0, "#94a3b8");
    grad.addColorStop(1, "#475569");
    context.fillStyle = grad;
    context.fill();
    // Bright top edge
    context.strokeStyle = "#cbd5e1";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, rOuter - wallThick * 0.4, Math.PI, 0, false);
    context.stroke();
    // Stone block notches
    context.strokeStyle = "rgba(255,255,255,0.2)";
    context.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const a = Math.PI - (i * Math.PI) / 5;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      context.beginPath();
      context.moveTo(cos * (rInner + 1), sin * (rInner + 1));
      context.lineTo(cos * (rOuter - 1), sin * (rOuter - 1));
      context.stroke();
    }
    context.restore();
  } else if (kind === "tower") {
    context.fillStyle = "#cbd5e1";
    context.beginPath();
    context.roundRect(x - 10, y - 18, 20, 36, 4);
    context.fill();
    context.fillStyle = "#94a3b8";
    context.fillRect(x - 14, y - 22, 28, 6);
    if (occupied) {
      context.strokeStyle = "rgba(74, 222, 128, 0.9)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y - 18, 8, 0, Math.PI * 2);
      context.stroke();
    }
  } else if (kind === "spikeTrap") {
    context.fillStyle = "#f59e0b";
    for (const dx of [-9, 0, 9]) {
      context.beginPath();
      context.moveTo(x + dx, y - 10);
      context.lineTo(x + dx + 6, y + 8);
      context.lineTo(x + dx - 6, y + 8);
      context.closePath();
      context.fill();
    }
  } else {
    const blast = context.createRadialGradient(x - 2, y - 2, 2, x, y, radius);
    blast.addColorStop(0, "#fde68a");
    blast.addColorStop(1, "#ca8a04");
    context.fillStyle = blast;
    context.beginPath();
    context.arc(x, y, radius * 0.78, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.3)";
    context.beginPath();
    context.arc(x, y, radius * 0.48, 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();
}

export function drawProjectileAvatar(
  context: CanvasRenderingContext2D,
  kind: ProjectileKind,
  x: number,
  y: number,
  angle: number,
  radius: number,
  alpha: number,
): void {
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.rotate(angle);

  if (kind === "arrow") {
    context.strokeStyle = "#86efac";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-radius * 1.6, 0);
    context.lineTo(radius * 1.25, 0);
    context.stroke();
    context.fillStyle = "#dcfce7";
    context.beginPath();
    context.moveTo(radius * 1.25, 0);
    context.lineTo(radius * 0.28, -radius * 0.5);
    context.lineTo(radius * 0.28, radius * 0.5);
    context.closePath();
    context.fill();
  } else if (kind === "hex") {
    context.fillStyle = "#c084fc";
    context.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI * 2 * i) / 6;
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
  } else if (kind === "bone") {
    context.strokeStyle = "#e2e8f0";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-radius, 0);
    context.lineTo(radius, 0);
    context.stroke();
    context.fillStyle = "#f8fafc";
    context.beginPath();
    context.arc(-radius, 0, radius * 0.32, 0, Math.PI * 2);
    context.arc(radius, 0, radius * 0.32, 0, Math.PI * 2);
    context.fill();
  } else {
    const glow = context.createRadialGradient(0, 0, 1, 0, 0, radius * 1.35);
    glow.addColorStop(0, "#f8fafc");
    glow.addColorStop(1, "#60a5fa");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

export function drawEffectAvatar(
  context: CanvasRenderingContext2D,
  kind: EffectKind,
  x: number,
  y: number,
  radius: number,
  progress: number,
  color: string,
): void {
  context.save();
  const alpha = Math.max(0, 1 - progress);
  context.globalAlpha = alpha;

  if (kind === "hit" || kind === "spike") {
    context.strokeStyle = color;
    context.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const angle = progress * 0.8 + (Math.PI / 2) * i;
      const inner = radius * 0.22;
      const outer = radius * (0.75 + progress * 0.45);
      context.beginPath();
      context.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      context.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      context.stroke();
    }
  } else if (kind === "whirlwind") {
    context.strokeStyle = color;
    context.lineWidth = 2.2;
    for (let i = 0; i < 3; i += 1) {
      context.beginPath();
      context.arc(x, y, radius * (0.42 + i * 0.24 + progress * 0.12), progress * 4 + i * 0.8, progress * 4 + i * 0.8 + 1.6);
      context.stroke();
    }
  } else if (kind === "guard" || kind === "taunt") {
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, radius * (0.38 + progress * 0.72), 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = alpha * 0.22;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius * (0.16 + progress * 0.28), 0, Math.PI * 2);
    context.fill();
  } else if (kind === "dodge") {
    context.strokeStyle = color;
    context.lineWidth = 1.8;
    for (let i = 0; i < 3; i += 1) {
      const dx = (i - 1) * radius * 0.34;
      context.beginPath();
      context.moveTo(x + dx - radius * 0.22, y + radius * 0.28);
      context.lineTo(x + dx + radius * 0.2, y - radius * 0.34);
      context.stroke();
    }
  } else if (kind === "blast" || kind === "smite") {
    context.strokeStyle = color;
    context.lineWidth = kind === "smite" ? 3 : 2;
    context.beginPath();
    context.arc(x, y, radius * (0.24 + progress * 0.96), 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = alpha * 0.24;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius * (0.14 + progress * 0.48), 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}
