
import * as React from "react";
import { useAuth } from "@app/auth/AuthProvider";


/* -------------------------------------------------------------------------- */
/*                               RBAC helpers                                 */
/* -------------------------------------------------------------------------- */

export type RoleLevel = "public" | "authed" | "user" | "admin" | "dev";

export type Claims = {
  uid?: string;
  topRole?: string;   // canonical ladder role, same idea as backend
  roles?: string[];   // FE tags; never used to escalate power
  caps?: string[];    // backend-owned capabilities
};

const LEVEL_RANK: Record<RoleLevel, number> = {
  public: 0,
  authed: 1,
  user: 2,
  admin: 3,
  dev: 4,
};

const normTok = (v: unknown) =>
  String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "");

/**
 * Map backend-like topRole to a level rank.
 * This mirrors your backend rbac.ts ladder in spirit, not byte-for-byte.
 */
function roleRankFromClaims(claims: Claims | null | undefined): number {
  if (!claims?.uid) return LEVEL_RANK.public;

  const tr = normTok(claims.topRole);

  if (["superdev", "orgdev", "dev"].includes(tr)) return LEVEL_RANK.dev;
  if (tr === "admin") return LEVEL_RANK.admin;
  if (tr === "unverified" || tr === "publicuser" || tr === "") {
    return LEVEL_RANK.authed;
  }
  // default authed user
  return LEVEL_RANK.user;
}

function hasLevel(claims: Claims | null | undefined, level: RoleLevel) {
  return roleRankFromClaims(claims) >= LEVEL_RANK[level];
}

/** FE tags (roles[]) stripped of obvious ladder-like tokens. */
function roleTagsFromClaims(claims: Claims | null | undefined): string[] {
  if (!claims) return [];
  const raw = Array.isArray(claims.roles) ? claims.roles : [];
  const tags = raw
    .map(normTok)
    .filter(Boolean)
    .filter(
      (t) =>
        ![
          "unverified",
          "public",
          "publicuser",
          "user",
          "admin",
          "dev",
          "orgdev",
          "superdev",
        ].includes(t)
    );
  return Array.from(new Set(tags));
}

/** Wildcard-ish cap matching similar to backend. */
function capMatchesWant(cap: string, want: string) {
  cap = normTok(cap);
  want = normTok(want);
  if (!cap || !want) return false;
  if (cap === "*") return true;

  const hasLead = cap.startsWith("*");
  const hasTrail = cap.endsWith("*");

  if (hasLead && hasTrail && cap.length > 2) {
    const inner = cap.slice(1, -1);
    return want.includes(inner);
  }
  if (hasLead && cap.length > 1) {
    const inner = cap.slice(1);
    return want.endsWith(inner) || want.includes(inner);
  }
  if (hasTrail && cap.length > 1) {
    const inner = cap.slice(0, -1);
    return want.startsWith(inner);
  }
  return cap === want;
}

function hasAnyCap(claims: Claims | null | undefined, wants: string[]) {
  if (!claims || !Array.isArray(claims.caps) || !claims.caps.length) {
    return false;
  }
  const caps = claims.caps.map(normTok);
  for (const w of wants) {
    const want = normTok(w);
    if (!want) continue;
    for (const cap of caps) {
      if (capMatchesWant(cap, want)) return true;
    }
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*                           Role gate evaluation                             */
/* -------------------------------------------------------------------------- */

export type GateMode = "hide" | "disable" | "readonly";

export type GateProps = {
  /** Minimum ladder level required. */
  requireLevel?: RoleLevel;
  /** Require at least ONE of these FE tags (roles[]). */
  requireRoles?: string[];
  /** Require at least ONE of these caps (supports wildcards like backend). */
  requireCaps?: string[];
  /** What to do when user fails gate (default: "hide"). */
  gateMode?: GateMode;
};

export type GateResult = {
  allowed: boolean;
  /** Whether the component should render at all. */
  shouldRender: boolean;
  /** Whether the component should be disabled. */
  disabled: boolean;
  /** Whether the component should be readOnly (for text inputs). */
  readOnly: boolean;
};

/**
 * Plug this into your existing auth system.
 * For now, default implementation returns `null` (public user).
 * Replace with your real hook and wire through ID token claims.
 */
export function useAuthClaims(): Claims | null {
  const { user, profile } = useAuth();

  if (!user) return null;

  // Normalize roles from profile
  const rawRoles: string[] = Array.isArray(profile?.roles)
    ? (profile!.roles as string[])
    : profile?.role
    ? [String(profile.role)]
    : [];

  const roles = rawRoles
    .filter(Boolean)
    .map((r) => String(r).toLowerCase().trim());

  // Prefer explicit topRole if you ever add it to profile,
  // otherwise just climb from roles[0].
  const topRole =
    (profile as any)?.topRole ||
    roles[0] ||
    "user";

  // Optional caps, if you choose to add them to profile later
  const rawCaps = (profile as any)?.caps;
  const caps: string[] = Array.isArray(rawCaps)
    ? rawCaps.filter(Boolean).map((c: any) => String(c))
    : [];

  return {
    uid: user.uid,
    topRole,
    roles,
    caps,
  };
}

export function evaluateGate(
  claims: Claims | null | undefined,
  { requireLevel, requireRoles, requireCaps, gateMode }: GateProps
): GateResult {
  const mode: GateMode = gateMode || "hide";
  const roles = (requireRoles || []).filter(Boolean);
  const caps = (requireCaps || []).filter(Boolean);

  const needsGate =
    requireLevel !== undefined ||
    (roles && roles.length > 0) ||
    (caps && caps.length > 0);

  // No gating requested -> always allowed and interactive
  if (!needsGate) {
    return {
      allowed: true,
      shouldRender: true,
      disabled: false,
      readOnly: false,
    };
  }

  let allowed = true;

  if (requireLevel && !hasLevel(claims, requireLevel)) {
    allowed = false;
  }

  if (allowed && roles.length) {
    const tags = roleTagsFromClaims(claims);
    const tagSet = new Set(tags);
    const ok = roles.some((r) => tagSet.has(normTok(r)));
    if (!ok) allowed = false;
  }

  if (allowed && caps.length) {
    const ok = hasAnyCap(claims, caps);
    if (!ok) allowed = false;
  }

  if (allowed) {
    return {
      allowed: true,
      shouldRender: true,
      disabled: false,
      readOnly: false,
    };
  }

  // Not allowed
  if (mode === "hide") {
    return {
      allowed: false,
      shouldRender: false,
      disabled: true,
      readOnly: true,
    };
  }
  if (mode === "readonly") {
    return {
      allowed: false,
      shouldRender: true,
      disabled: false,
      readOnly: true,
    };
  }
  // mode === "disable"
  return {
    allowed: false,
    shouldRender: true,
    disabled: true,
    readOnly: false,
  };
}

/**
 * Hook version – pulls claims from useAuthClaims().
 */
export function useRoleGate(props: GateProps): GateResult {
  const claims = useAuthClaims();
  return React.useMemo(
    () => evaluateGate(claims, props),
    [claims, props.requireLevel, props.requireRoles, props.requireCaps, props.gateMode]
  );
}

/* -------------------------------------------------------------------------- */
/*                             RoleGate wrapper                               */
/* -------------------------------------------------------------------------- */

export type RoleGateProps = GateProps & {
  children: React.ReactNode;
  /** Optional fallback (e.g. lock icon) when disabled/readonly. */
  fallback?: React.ReactNode;
};

export const RoleGate: React.FC<RoleGateProps> = ({
  children,
  fallback,
  ...gate
}) => {
  const { allowed, shouldRender, disabled, readOnly } = useRoleGate(gate);

  if (!shouldRender) return null;

  if (allowed) return <>{children}</>;

  // For now: "disabled" and "readonly" both show fallback if provided, else nothing extra.
  return (
    <>
      {children}
      {fallback ?? null}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*                          Base field props / helpers                        */
/* -------------------------------------------------------------------------- */

export type FieldSize = "sm" | "md" | "lg";
export type FieldVariant = "solid" | "outline" | "ghost";

type BaseFieldProps = GateProps & {
  id?: string;
  tourId?: string;
  label?: string;
  description?: string;
  helperText?: string;
  error?: string | null;
  size?: FieldSize;
  variant?: FieldVariant;
  fullWidth?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  /** Data-test hook */
  "data-testid"?: string;
};

function joinClasses(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function sizeClass(size: FieldSize = "md") {
  switch (size) {
    case "sm":
      return "rg-field--sm";
    case "lg":
      return "rg-field--lg";
    default:
      return "rg-field--md";
  }
}

function variantClass(variant: FieldVariant = "outline") {
  return `rg-field--${variant}`;
}

/* -------------------------------------------------------------------------- */
/*                               Checkbox                                     */
/* -------------------------------------------------------------------------- */

export type RGCheckboxProps = BaseFieldProps & {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (next: boolean) => void;
  /** If true, renders a switch-style checkbox (styling concern only). */
  asSwitch?: boolean;
};

export const RGCheckbox: React.FC<RGCheckboxProps> = (props) => {
  const {
    label,
    description,
    helperText,
    error,
    size,
    variant,
    fullWidth,
    className,
    labelClassName,
    inputClassName,
    "data-testid": dataTestId,
    tourId,
    asSwitch,
    requireLevel,
    requireRoles,
    requireCaps,
    gateMode,
    checked,
    defaultChecked,
    onChange,
    name,
  } = props;

  const gate = useRoleGate({ requireLevel, requireRoles, requireCaps, gateMode });
  if (!gate.shouldRender) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!gate.allowed || gate.readOnly) return;
    onChange?.(e.target.checked);
  };

  const wrapperCls = joinClasses(
    "rg-field",
    "rg-checkbox",
    sizeClass(size),
    variantClass(variant),
    fullWidth && "rg-field--full",
    !gate.allowed && gate.disabled && "rg-field--disabled",
    !gate.allowed && gate.readOnly && "rg-field--readonly",
    className
  );

  const inputCls = joinClasses(
    "rg-checkbox__input",
    asSwitch && "rg-checkbox__input--switch",
    inputClassName
  );

  return (
    <div className={wrapperCls} data-testid={dataTestId} data-role-gated={!gate.allowed} data-tour={tourId}>
      <label className={joinClasses("rg-field__label", labelClassName)}>
        <input
          type="checkbox"
          name={name}
          className={inputCls}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={handleChange}
          disabled={gate.disabled}
          data-tour={tourId ? `${tourId}-input` : undefined}
        />
        {label && <span className="rg-field__label-text">{label}</span>}
      </label>
      {description && (
        <div className="rg-field__description">{description}</div>
      )}
      {error ? (
        <div className="rg-field__error">{error}</div>
      ) : helperText ? (
        <div className="rg-field__helper">{helperText}</div>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                               Toggle group                                 */
/* -------------------------------------------------------------------------- */

export type ToggleOption = {
  value: string;
  label: string;
  /** Optional short hint or badge text. */
  hint?: string;
  disabled?: boolean;
};

export type RGToggleGroupProps = BaseFieldProps & {
  name?: string;
  options: ToggleOption[]; // up to 3 options recommended
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (next: string) => void;
  ariaLabel?: string;
  optionClassName?: string;
  activeOptionClassName?: string;
  inactiveOptionClassName?: string;
};

export const RGToggleGroup: React.FC<RGToggleGroupProps> = (props) => {
  const {
    label,
    description,
    helperText,
    error,
    size,
    variant,
    fullWidth,
    className,
    labelClassName,
    inputClassName,
    "data-testid": dataTestId,
    tourId,
    options,
    name,
    value,
    defaultValue,
    onChange,
    ariaLabel,
    optionClassName,
    activeOptionClassName,
    inactiveOptionClassName,
    requireLevel,
    requireRoles,
    requireCaps,
    gateMode,
  } = props;

  const gate = useRoleGate({ requireLevel, requireRoles, requireCaps, gateMode });
  if (!gate.shouldRender) return null;

  const current = value ?? defaultValue ?? null;

  const handleClick = (opt: ToggleOption) => {
    if (!gate.allowed || gate.readOnly || gate.disabled || opt.disabled) return;
    onChange?.(opt.value);
  };

  const wrapperCls = joinClasses(
    "rg-field",
    "rg-toggle-group",
    sizeClass(size),
    variantClass(variant),
    fullWidth && "rg-field--full",
    !gate.allowed && gate.disabled && "rg-field--disabled",
    !gate.allowed && gate.readOnly && "rg-field--readonly",
    className
  );

  return (
    <div className={wrapperCls} data-testid={dataTestId} data-role-gated={!gate.allowed} data-tour={tourId}>
      {label && (
        <div className={joinClasses("rg-field__label", labelClassName)}>
          {label}
        </div>
      )}
      <div className={joinClasses("rg-toggle-group__container", inputClassName)}>
        {options.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              name={name}
              className={joinClasses(
                "rg-toggle-group__option",
                active && "rg-toggle-group__option--active",
                opt.disabled && "rg-toggle-group__option--disabled",
                optionClassName,
                active ? activeOptionClassName : inactiveOptionClassName
              )}
              onClick={() => handleClick(opt)}
              disabled={gate.disabled || !!opt.disabled}
              aria-pressed={active}
              aria-label={ariaLabel ? `${ariaLabel}: ${opt.label}` : undefined}
              data-tour={tourId ? `${tourId}-option-${opt.value}` : undefined}
            >
              <span className="rg-toggle-group__label">{opt.label}</span>
              {opt.hint && (
                <span className="rg-toggle-group__hint">{opt.hint}</span>
              )}
            </button>
          );
        })}
      </div>
      {description && (
        <div className="rg-field__description">{description}</div>
      )}
      {error ? (
        <div className="rg-field__error">{error}</div>
      ) : helperText ? (
        <div className="rg-field__helper">{helperText}</div>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                   Select                                   */
/* -------------------------------------------------------------------------- */

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectOptionGroup = {
  label: string;
  options: SelectOption[];
  disabled?: boolean;
};

export type RGSelectProps = BaseFieldProps & {
  name?: string;
  options: Array<SelectOption | SelectOptionGroup>;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (next: string) => void;
  disabled?: boolean;
  placeholderOption?: string; // e.g. "Select…"
  placeholderDisabled?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
};

export const RGSelect: React.FC<RGSelectProps> = (props) => {
  const {
    label,
    description,
    helperText,
    error,
    size,
    variant,
    fullWidth,
    className,
    labelClassName,
    inputClassName,
    "data-testid": dataTestId,
    tourId,
    options,
    name,
    value,
    defaultValue,
    onChange,
    disabled,
    placeholderOption,
    placeholderDisabled = true,
    onBlur,
    id,
    requireLevel,
    requireRoles,
    requireCaps,
    gateMode,
  } = props;

  const gate = useRoleGate({ requireLevel, requireRoles, requireCaps, gateMode });
  if (!gate.shouldRender) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!gate.allowed || gate.readOnly) return;
    onChange?.(e.currentTarget?.value ?? "");
  };

  const wrapperCls = joinClasses(
    "rg-field",
    "rg-select",
    sizeClass(size),
    variantClass(variant),
    fullWidth && "rg-field--full",
    !gate.allowed && gate.disabled && "rg-field--disabled",
    !gate.allowed && gate.readOnly && "rg-field--readonly",
    className
  );

  const selectCls = joinClasses("rg-select__input", inputClassName);
  const isGroup = (opt: SelectOption | SelectOptionGroup): opt is SelectOptionGroup =>
    !!opt && typeof opt === "object" && Array.isArray((opt as SelectOptionGroup).options);
  const selectValue = value ?? defaultValue ?? "";

  return (
    <div className={wrapperCls} data-testid={dataTestId} data-role-gated={!gate.allowed} data-tour={tourId}>
      {label && (
        <label htmlFor={id} className={joinClasses("rg-field__label", labelClassName)}>
          {label}
        </label>
      )}
      <select
        name={name}
        id={id}
        className={selectCls}
        value={selectValue}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={gate.disabled || !!disabled}
        data-tour={tourId ? `${tourId}-input` : undefined}
      >
        {placeholderOption && (
          <option value="" disabled={placeholderDisabled}>
            {placeholderOption}
          </option>
        )}
        {options.map((opt) =>
          isGroup(opt) ? (
            <optgroup key={`group:${opt.label}`} label={opt.label} disabled={!!opt.disabled}>
              {opt.options.map((child) => (
                <option key={child.value} value={child.value} disabled={!!child.disabled}>
                  {child.label}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={opt.value} value={opt.value} disabled={!!opt.disabled}>
              {opt.label}
            </option>
          )
        )}
      </select>
      {description && (
        <div className="rg-field__description">{description}</div>
      )}
      {error ? (
        <div className="rg-field__error">{error}</div>
      ) : helperText ? (
        <div className="rg-field__helper">{helperText}</div>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                Text input                                  */
/* -------------------------------------------------------------------------- */

export type RGTextInputProps = BaseFieldProps & {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?:
    | "text"
    | "email"
    | "number"
    | "password"
    | "search"
    | "date"
    | "time"
    | "datetime-local"
    | "tel"
    | "url";
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  min?: number | string;
  max?: number | string;
  step?: number | string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
};

export const RGTextInput: React.FC<RGTextInputProps> = (props) => {
  const {
    label,
    description,
    helperText,
    error,
    size,
    variant,
    fullWidth,
    className,
    labelClassName,
    inputClassName,
    "data-testid": dataTestId,
    tourId,
    name,
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    type = "text",
    placeholder,
    autoComplete,
    inputMode,
    min,
    max,
    step,
    required,
    multiline,
    rows = 3,
    id,
    requireLevel,
    requireRoles,
    requireCaps,
    gateMode,
  } = props;

  const gate = useRoleGate({ requireLevel, requireRoles, requireCaps, gateMode });
  if (!gate.shouldRender) return null;

  const wrapperCls = joinClasses(
    "rg-field",
    "rg-text",
    sizeClass(size),
    variantClass(variant),
    fullWidth && "rg-field--full",
    !gate.allowed && gate.disabled && "rg-field--disabled",
    !gate.allowed && gate.readOnly && "rg-field--readonly",
    className
  );

  const inputCls = joinClasses("rg-text__input", inputClassName);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!gate.allowed || gate.readOnly) return;
    onChange?.(e.currentTarget.value);
  };

  const commonProps = {
    name,
    className: inputCls,
    value,
    defaultValue,
    onChange: handleChange,
    onBlur,
    onFocus,
    placeholder,
    disabled: gate.disabled,
    readOnly: gate.readOnly,
    required,
    id,
  };

  return (
    <div className={wrapperCls} data-testid={dataTestId} data-role-gated={!gate.allowed} data-tour={tourId}>
      {label && (
        <label htmlFor={id} className={joinClasses("rg-field__label", labelClassName)}>
          {label}
        </label>
      )}
      {multiline ? (
        <textarea {...commonProps} rows={rows} data-tour={tourId ? `${tourId}-input` : undefined} />
      ) : (
        <input
          {...commonProps}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          data-tour={tourId ? `${tourId}-input` : undefined}
        />
      )}
      {description && (
        <div className="rg-field__description">{description}</div>
      )}
      {error ? (
        <div className="rg-field__error">{error}</div>
      ) : helperText ? (
        <div className="rg-field__helper">{helperText}</div>
      ) : null}
    </div>
  );
};
