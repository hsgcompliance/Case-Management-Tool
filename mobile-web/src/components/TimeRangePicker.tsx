import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";

// ─── Layout constants (SVG coordinate space 0–300) ───────────────────────────
const CX = 150;
const CY = 150;
const VIEWBOX_SIZE = 300;

const TRACK_R = 112;
const STROKE = 16;
const HANDLE_R = 17;
const TOUCH_R = HANDLE_R + 11;       // = 28
const RING_R = HANDLE_R + 7;         // = 24
const TICK_OUTER = 127;
const LABEL_R = 141;

// Hold must complete within DEAD_PX radius movement, then takes full HOLD_MS.
const HOLD_MS = 200;
const DEAD_PX = 28;

// Per-event pixel delta below this threshold → 1-min granularity (precision mode).
const PRECISION_PX = 3;
// Module-level mutable — tracks per-gesture precision state, reset on pointer up.
let precisionStartedAt: number | null = null;

const MINUTES_PER_DAY = 1440;
const LAST_MINUTE = 23 * 60 + 59;

const CIRCUMFERENCE = +(2 * Math.PI * RING_R).toFixed(2);

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function minToDeg(min: number) {
  return (min / MINUTES_PER_DAY) * 360 - 90;
}

function polar(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcD(startMin: number, endMin: number, r: number) {
  const sp = polar(minToDeg(startMin), r);
  const ep = polar(minToDeg(endMin), r);
  const large = endMin - startMin > 720 ? 1 : 0;
  return `M${sp.x.toFixed(2)},${sp.y.toFixed(2)} A${r},${r} 0 ${large},1 ${ep.x.toFixed(2)},${ep.y.toFixed(2)}`;
}

function snapMin(min: number, step: number) {
  return Math.round(min / step) * step;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function normalizeMinute(min: number) {
  return clamp(Math.round(min), 0, LAST_MINUTE);
}

function toHHMM(min: number) {
  const s = normalizeMinute(min);
  return `${String(Math.floor(s / 60) % 24).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function parseHHMM(t: string) {
  if (!t) return null;
  const [hRaw, mRaw] = t.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return normalizeMinute(h * 60 + m);
}

function fmt(min: number, use24: boolean) {
  const s = normalizeMinute(min);
  const h = Math.floor(s / 60) % 24;
  const m = s % 60;
  const mm = String(m).padStart(2, "0");
  if (use24) return `${String(h).padStart(2, "0")}:${mm}`;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mm} ${ampm}`;
}

function durLabel(minutes: number) {
  const m = Math.max(0, minutes);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function getDefaultRange(step: number) {
  const now = new Date();
  const prev = new Date(now);
  prev.setHours(now.getHours() - 1, 0, 0, 0);
  const start = prev.getHours() * 60;
  const end = clamp(snapMin(now.getHours() * 60 + now.getMinutes(), step), start + step, LAST_MINUTE);
  return { start, end };
}

function getSafeInitialRange(startTime: string, endTime: string, step: number) {
  const defaults = getDefaultRange(step);
  const ps = parseHHMM(startTime);
  const pe = parseHHMM(endTime);
  if (ps === null || pe === null) return defaults;
  if (pe <= ps) return { start: ps, end: clamp(ps + step, ps + step, LAST_MINUTE) };
  return { start: ps, end: pe };
}

// ─── Tick geometry ────────────────────────────────────────────────────────────

const TICKS = Array.from({ length: 96 }, (_, i) => {
  const h = i / 4;
  const isHour = i % 4 === 0;
  const isWork = h >= 6 && h <= 21;
  const deg = minToDeg(i * 15);
  const tickLen = isHour ? (isWork ? 11 : 7) : 4;
  return {
    outer: polar(deg, TICK_OUTER),
    inner: polar(deg, TICK_OUTER - tickLen),
    label: polar(deg, LABEL_R),
    isHour,
    isWork,
    showLabel: isHour && isWork,
    hInt: Math.floor(h),
    strokeColor: isWork ? (isHour ? "#94a3b8" : "#cbd5e1") : "#e2e8f0",
    strokeW: isHour ? 1.5 : 1,
  };
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Handle = "start" | "end";

interface TimeRangePickerProps {
  startTime: string;
  endTime: string;
  onChange: (start: string, end: string) => void;
  step?: number;
  use24h?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TimeRangePicker({
  startTime,
  endTime,
  onChange,
  step = 15,
  use24h = false,
}: TimeRangePickerProps) {
  const initialRange = useMemo(
    () => getSafeInitialRange(startTime, endTime, step),
    // Only used for first render — parent changes handled by the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [enabled, setEnabled] = useState(Boolean(startTime && endTime));
  const [startMin, setStartMin] = useState(initialRange.start);
  const [endMin, setEndMin] = useState(initialRange.end);
  const [dragging, setDragging] = useState<Handle | null>(null);
  const [pending, setPending] = useState<Handle | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const startRef = useRef(startMin);
  const endRef = useRef(endMin);
  const enabledRef = useRef(enabled);
  const draggingRef = useRef<Handle | null>(null);
  const pendingRef = useRef<Handle | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const capturedId = useRef<number | null>(null);
  // Adaptive step tracking
  const lastMovePos = useRef<{ x: number; y: number } | null>(null);
  const dynamicStepRef = useRef(step);

  startRef.current = startMin;
  endRef.current = endMin;
  enabledRef.current = enabled;
  draggingRef.current = dragging;
  pendingRef.current = pending;

  // Lock document scroll while a handle is actively being dragged.
  useEffect(() => {
    if (!dragging) return;
    const prevent = (e: TouchEvent) => { e.preventDefault(); };
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, [dragging]);

  // Sync when parent form resets or pre-populates times.
  useEffect(() => {
    const nextEnabled = Boolean(startTime && endTime);
    setEnabled(nextEnabled);
    if (!nextEnabled) return;
    const ns = parseHHMM(startTime);
    const ne = parseHHMM(endTime);
    if (ns === null || ne === null) return;
    const ss = clamp(ns, 0, LAST_MINUTE - step);
    const se = clamp(ne, ss + step, LAST_MINUTE);
    setStartMin(ss);
    setEndMin(se);
    startRef.current = ss;
    endRef.current = se;
  }, [startTime, endTime, step]);

  // Emit uses gapStep so precision mode (1 min) can let handles get close.
  const emit = useCallback(
    (nextStart: number, nextEnd: number, gapStep: number = step) => {
      const g = Math.max(1, gapStep);
      const ss = clamp(nextStart, 0, LAST_MINUTE - g);
      const se = clamp(nextEnd, ss + g, LAST_MINUTE);
      setStartMin(ss);
      setEndMin(se);
      startRef.current = ss;
      endRef.current = se;
      if (enabledRef.current) onChange(toHHMM(ss), toHHMM(se));
    },
    [onChange, step],
  );

  const cancelHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    pendingRef.current = null;
    setPending(null);
  }, []);

  const releaseCapture = useCallback(() => {
    if (capturedId.current === null) return;
    try { svgRef.current?.releasePointerCapture(capturedId.current); } catch { /* no-op */ }
    capturedId.current = null;
  }, []);

  // snapStep is passed explicitly so precision mode is isolated to the event handler.
  const clientToMin = useCallback((clientX: number, clientY: number, snapStep: number) => {
    const svg = svgRef.current;
    if (!svg) return startRef.current;
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) * (VIEWBOX_SIZE / rect.width);
    const y = (clientY - rect.top) * (VIEWBOX_SIZE / rect.height);
    const deg = (Math.atan2(y - CY, x - CX) * 180) / Math.PI + 90;
    return snapMin(((((deg % 360) + 360) % 360) / 360) * MINUTES_PER_DAY, snapStep);
  }, []);

  const startDragging = useCallback(
    (handle: Handle) => {
      draggingRef.current = handle;
      setDragging(handle);
      pendingRef.current = null;
      setPending(null);
      // Always begin at the configured step; precision mode activates as movement slows.
      dynamicStepRef.current = step;
      lastMovePos.current = null;
      if ("vibrate" in navigator) navigator.vibrate(12);
    },
    [step],
  );

  const handlePointerDown = useCallback(
    (handle: Handle, e: ReactPointerEvent<SVGCircleElement>) => {
      e.stopPropagation();
      cancelHold();
      pendingRef.current = handle;
      capturedId.current = e.pointerId;
      downPos.current = { x: e.clientX, y: e.clientY };
      setPending(handle);
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* no-op */ }
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        startDragging(handle);
      }, HOLD_MS);
    },
    [cancelHold, startDragging],
  );

  const handleMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      // Hold phase: cancel if finger leaves the hold radius.
      if (pendingRef.current && downPos.current) {
        const dx = e.clientX - downPos.current.x;
        const dy = e.clientY - downPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > DEAD_PX) {
          cancelHold();
          releaseCapture();
          downPos.current = null;
          return;
        }
      }

      if (!draggingRef.current) return;

      e.preventDefault();

      // Adaptive step: per-frame pixel delta < PRECISION_PX → 1-min granularity.
      const prev = lastMovePos.current;
      const delta = prev
        ? Math.sqrt((e.clientX - prev.x) ** 2 + (e.clientY - prev.y) ** 2)
        : 999;
      const now = performance.now();

      if (delta < PRECISION_PX) {
        if (precisionStartedAt === null) {
          precisionStartedAt = now;
        }

        dynamicStepRef.current =
          now - precisionStartedAt > 500 ? 1 : step;
      } else {
        precisionStartedAt = null;
        dynamicStepRef.current = step;
      }
      lastMovePos.current = { x: e.clientX, y: e.clientY };

      const curStep = dynamicStepRef.current;
      const raw = clientToMin(e.clientX, e.clientY, curStep);

      if (draggingRef.current === "start") {
        emit(clamp(raw, 0, endRef.current - curStep), endRef.current, curStep);
      } else {
        emit(startRef.current, clamp(raw, startRef.current + curStep, LAST_MINUTE), curStep);
      }
    },
    [cancelHold, clientToMin, emit, releaseCapture, step],
  );

  const endPointerInteraction = useCallback(() => {
    cancelHold();
    releaseCapture();
    capturedId.current = null;
    downPos.current = null;
    lastMovePos.current = null;
    dynamicStepRef.current = step;
    precisionStartedAt = null;
    if (draggingRef.current) {
      draggingRef.current = null;
      setDragging(null);
    }
  }, [cancelHold, releaseCapture, step]);

  const handleToggle = useCallback(() => {
    const next = !enabledRef.current;
    setEnabled(next);
    enabledRef.current = next;
    onChange(next ? toHHMM(startRef.current) : "", next ? toHHMM(endRef.current) : "");
  }, [onChange]);

  const handleTimeInput = useCallback(
    (which: Handle, value: string) => {
      const parsed = parseHHMM(value);
      if (parsed === null) return;
      if (which === "start") {
        emit(clamp(parsed, 0, endRef.current - step), endRef.current);
      } else {
        emit(startRef.current, clamp(parsed, startRef.current + step, LAST_MINUTE));
      }
    },
    [emit, step],
  );

  const duration = endMin - startMin;
  const startPos = polar(minToDeg(startMin), TRACK_R);
  const endPos = polar(minToDeg(endMin), TRACK_R);

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-2">
      {/* Toggle header */}
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {enabled ? `Time · ${durLabel(duration)}` : "Time (optional)"}
        </span>
        <button
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-slate-200"
          }`}
          aria-pressed={enabled}
          aria-label={enabled ? "Disable time range" : "Enable time range"}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="flex max-w-full flex-col items-center gap-2 overflow-x-hidden pt-1">
          <div className="relative w-full max-w-[360px] overflow-hidden">
            <svg
              ref={svgRef}
              viewBox="0 0 300 300"
              className={`block w-full select-none ${
                dragging ? "touch-none" : "touch-pan-y"
              }`}
              onPointerMove={handleMove}
              onPointerUp={endPointerInteraction}
              onPointerCancel={endPointerInteraction}
              onLostPointerCapture={endPointerInteraction}
            >
              {/* Tick marks + hour labels */}
              {TICKS.map((t, i) => (
                <g key={i}>
                  <line
                    x1={t.outer.x} y1={t.outer.y}
                    x2={t.inner.x} y2={t.inner.y}
                    stroke={t.strokeColor}
                    strokeWidth={t.strokeW}
                    strokeLinecap="round"
                  />
                  {t.showLabel && (
                    <text
                      x={t.label.x} y={t.label.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="8"
                      fill="#94a3b8"
                      fontWeight="500"
                      fontFamily="system-ui,-apple-system,sans-serif"
                    >
                      {use24h
                        ? t.hInt
                        : t.hInt === 0 ? "12a"
                        : t.hInt < 12 ? t.hInt
                        : t.hInt === 12 ? "12p"
                        : t.hInt - 12}
                    </text>
                  )}
                </g>
              ))}

              {/* Grey background track */}
              <circle cx={CX} cy={CY} r={TRACK_R} fill="none" stroke="#e2e8f0" strokeWidth={STROKE} />

              {/* Blue selected arc */}
              <path
                d={arcD(startMin, endMin, TRACK_R)}
                fill="none"
                stroke="#2563eb"
                strokeWidth={STROKE}
                strokeLinecap="round"
              />

              {/* White center disc — clears space for the HTML overlay */}
              <circle cx={CX} cy={CY} r={82} fill="white" />

              {/* Handles */}
              <RingHandle
                pos={startPos}
                icon="‹"
                active={dragging === "start"}
                pending={pending === "start"}
                onDown={(e) => handlePointerDown("start", e)}
              />
              <RingHandle
                pos={endPos}
                icon="›"
                active={dragging === "end"}
                pending={pending === "end"}
                onDown={(e) => handlePointerDown("end", e)}
              />
            </svg>

            {/*
              Single source of truth for the center time display.
              Tapping a time opens the native OS time picker.
              The SVG no longer renders duplicate text here.
            */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[155px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5">
              <TimeButtonInput
                label="Start time"
                value={toHHMM(startMin)}
                display={fmt(startMin, use24h)}
                step={step}
                onChange={(v) => handleTimeInput("start", v)}
              />
              <div className="h-px w-20 bg-blue-200" />
              <TimeButtonInput
                label="End time"
                value={toHHMM(endMin)}
                display={fmt(endMin, use24h)}
                step={step}
                onChange={(v) => handleTimeInput("end", v)}
              />
              <div className="pt-0.5 text-[11px] font-bold text-blue-300">
                {durLabel(duration)}
              </div>
            </div>
          </div>

          {/* Hint */}
          <p
            className={`text-center text-xs ${
              dragging
                ? "font-medium text-blue-600"
                : pending
                  ? "animate-pulse text-blue-400"
                  : "text-slate-400"
            }`}
          >
            {dragging
              ? `Adjusting ${dragging} time`
              : pending
                ? "Keep holding…"
                : "Tap a time to edit · Hold a handle to drag"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tappable time display that opens the native time picker ──────────────────

function TimeButtonInput({
  label,
  value,
  display,
  step,
  onChange,
}: {
  label: string;
  value: string;
  display: string;
  step: number;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if ("showPicker" in input && typeof input.showPicker === "function") {
      try { input.showPicker(); return; } catch { /* fall through */ }
    }
    input.click();
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      className="pointer-events-auto relative w-full rounded-xl px-2 py-0.5 text-center text-[26px] font-black leading-none text-blue-800 outline-none transition active:scale-[0.97] active:bg-blue-50/60"
      aria-label={label}
    >
      {display}
      <input
        ref={inputRef}
        type="time"
        value={value}
        step={step * 60}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </button>
  );
}

// ─── Handle with hold-progress ring ──────────────────────────────────────────

function RingHandle({
  pos,
  icon,
  active,
  pending,
  onDown,
}: {
  pos: { x: number; y: number };
  icon: string;
  active: boolean;
  pending: boolean;
  onDown: (e: ReactPointerEvent<SVGCircleElement>) => void;
}) {
  return (
    <g>
      {/* Invisible touch target */}
      <circle
        cx={pos.x} cy={pos.y} r={TOUCH_R}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onPointerDown={onDown}
      />

      {/* Hold-progress ring — animates from 0 to full circumference over HOLD_MS */}
      {pending && (
        <circle
          cx={pos.x} cy={pos.y} r={RING_R}
          fill="none"
          stroke="#93c5fd"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={
            {
              strokeDashoffset: CIRCUMFERENCE,
              animation: `holdProgress ${HOLD_MS}ms linear forwards`,
            } as CSSProperties
          }
        />
      )}

      {/* Visible disc */}
      <circle
        cx={pos.x} cy={pos.y}
        r={active ? HANDLE_R + 1 : HANDLE_R}
        fill={active ? "#1d4ed8" : "#2563eb"}
        style={{
          pointerEvents: "none",
          filter: active
            ? "drop-shadow(0 2px 8px rgba(37,99,235,.5))"
            : "drop-shadow(0 1px 3px rgba(15,23,42,.18))",
        }}
      />

      <text
        x={pos.x} y={pos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14"
        fill="white"
        fontWeight="700"
        style={{ pointerEvents: "none" }}
      >
        {icon}
      </text>
    </g>
  );
}
