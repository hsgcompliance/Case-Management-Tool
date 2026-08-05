export function isVoidedProjection(source: unknown, queueStatus: unknown, voidFlag?: unknown): boolean {
  return String(source || "").toLowerCase() === "projection"
    && (String(queueStatus || "").toLowerCase() === "void" || voidFlag === true);
}

export function shouldShowVoidedProjection(isVoided: boolean, showVoided: boolean): boolean {
  return !isVoided || showVoided;
}
