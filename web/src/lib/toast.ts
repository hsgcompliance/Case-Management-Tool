// web/src/lib/toast.ts
export type ToastKind = 'info' | 'success' | 'error' | 'warn' | 'warning';
export type ToastOpts = { duration?: number; type?: ToastKind };

export function toast(message: string, { duration = 3000, type = 'info' }: ToastOpts = {}) {
  const colors: Record<ToastKind, string> = {
    info: '#2563eb',
    success: '#16a34a',
    error: '#dc2626',
    warn: '#d9cb06ff',
    warning: '#d9cb06ff',
  };
  const t = document.createElement('div');
  t.textContent = message;
  t.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    background: ${colors[type] || colors.info};
    color: white; padding: 12px 18px; border-radius: 8px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25);
    font-size: 0.9rem; z-index: 12000; opacity: 0;
    transition: opacity .2s ease-in-out; max-width: 320px;
  `;
  document.body.appendChild(t);
  requestAnimationFrame(() => (t.style.opacity = '1'));
  setTimeout(() => {
    t.style.opacity = '0';
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, duration);
}
