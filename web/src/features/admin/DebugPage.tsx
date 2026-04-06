// web/features/admin/DebugPage.tsx
import React, { useState } from 'react';
import { auth, appCheck } from '@lib/firebase';
import { getToken as getAppCheckToken } from 'firebase/app-check';

export function DebugPanel() {
  const [idToken, setId] = useState<string | null>(null);
  const [acToken, setAc] = useState<string | null>(null);

  async function fetchTokens() {
    const id = await auth.currentUser?.getIdToken(true);
    const ac = appCheck ? await getAppCheckToken(appCheck) : null;
    setId(id || null);
    setAc(ac?.token || null);
  }

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-4 font-mono text-xs dark:border-slate-700 dark:bg-slate-900">
      <button
        onClick={fetchTokens}
        className="btn btn-sm"
      >
        Fetch Tokens
      </button>

      <div className="break-all whitespace-pre-wrap">
        <b>ID Token:</b>
        <div className="mt-1 max-h-60 overflow-y-auto rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
          {idToken || '(none)'}
        </div>
      </div>

      <div className="break-all whitespace-pre-wrap">
        <b>App Check Token:</b>
        <div className="mt-1 max-h-60 overflow-y-auto rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
          {acToken || '(none)'}
        </div>
      </div>

      <div className="break-all whitespace-pre-wrap">
        <b>Refresh Token:</b>
        <div className="mt-1 max-h-32 overflow-y-auto rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
            {auth.currentUser?.refreshToken || '(none)'}
        </div>
        </div>

        <div className="break-all whitespace-pre-wrap">
            <b>UID:</b>
        <div className="mt-1 rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">{auth.currentUser?.uid || '(none)'}</div>
        </div>
    </div>
  );
}


export default DebugPanel;
