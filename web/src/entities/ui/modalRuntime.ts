import React from "react";

let modalLockCount = 0;
let bodyOverflowBeforeModal = "";

export function useModalRuntime(isOpen: boolean, panelRef: React.RefObject<HTMLElement | null>) {
  const prevFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    prevFocusRef.current = document.activeElement as HTMLElement | null;

    if (modalLockCount === 0) {
      bodyOverflowBeforeModal = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.dataset.modalOpen = "true";
    }
    modalLockCount += 1;

    const t = window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(t);
      modalLockCount = Math.max(0, modalLockCount - 1);
      if (modalLockCount === 0) {
        document.body.style.overflow = bodyOverflowBeforeModal;
        delete document.documentElement.dataset.modalOpen;
        bodyOverflowBeforeModal = "";
      }
      prevFocusRef.current?.focus?.();
      prevFocusRef.current = null;
    };
  }, [isOpen, panelRef]);
}
