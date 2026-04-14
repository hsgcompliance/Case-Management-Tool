"use client";

import React from "react";
import { useLegacySecretGameLauncher } from "@features/secret-games";

/**
 * QuickBreakModal — thin shim kept for backward compat.
 *
 * When `open` transitions to true it opens the mini player in celebration mode
 * (centered, larger, lockout bypassed) then immediately calls `onClose` so the
 * parent can reset its own state. The actual UI lives inside GameMiniPlayer.
 */
export type QuickBreakModalProps = {
  open: boolean;
  onClose: () => void;
};

export function QuickBreakModal({ open, onClose }: QuickBreakModalProps) {
  const launchLegacySecretGame = useLegacySecretGameLauncher("legacy-host");
  const didOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      didOpenRef.current = false;
      return;
    }
    if (didOpenRef.current) return;
    didOpenRef.current = true;
    launchLegacySecretGame("legacy-runner", { celebration: true });
    onClose();
  }, [launchLegacySecretGame, onClose, open]);

  return null;
}

export default QuickBreakModal;
