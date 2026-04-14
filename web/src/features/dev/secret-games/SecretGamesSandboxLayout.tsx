"use client";

import React from "react";
import SecretGamesSandboxSidebar from "./SecretGamesSandboxSidebar";
import { SecretGamesSandboxProvider, useSecretGamesSandbox } from "./SecretGamesSandboxContext";

function SandboxScaffold({ children }: { children: React.ReactNode }) {
  const { customers } = useSecretGamesSandbox();

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Secret Games Sandbox
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Customer Page Clone
          </h1>
          <p className="max-w-4xl text-sm text-slate-600 dark:text-slate-300">
            Dev-only customer-page replica for secret-game testing. The main panel mirrors the current customers page
            with a capped live sample, while the side rail holds launch controls, lab scope, registry state, and
            storage tools.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Card-lab fixture pool: {customers.length} fake customers. Production customer data and production page mounts stay untouched.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
        <main className="space-y-6">{children}</main>
        <aside>
          <SecretGamesSandboxSidebar />
        </aside>
      </div>
    </div>
  );
}

export default function SecretGamesSandboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <SecretGamesSandboxProvider>
      <SandboxScaffold>{children}</SandboxScaffold>
    </SecretGamesSandboxProvider>
  );
}
