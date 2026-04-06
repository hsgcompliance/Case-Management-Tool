"use client";

import React from "react";
import { AnyDashboardToolDefinition, NavCrumb } from "../types";
import { useAuth } from "@app/auth/AuthProvider";
import Inbox from "@client/inbox";
import { toast } from "@lib/toast";

export interface ToolTopbarRowProps {
  tool: AnyDashboardToolDefinition;
  filterState: unknown;
  setFilterState: (next: unknown) => void;
  selection: unknown | null;
  navStack: NavCrumb<unknown>[];
  nav: {
    push: (c: NavCrumb<unknown>) => void;
    pop: () => void;
    reset: () => void;
    setStack: (s: NavCrumb<unknown>[]) => void;
  };
}

function DigestSubscribeButton({ digestType }: { digestType: NonNullable<AnyDashboardToolDefinition["digestType"]> }) {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Load current subscription state once
  React.useEffect(() => {
    if (!user?.uid) return;
    Inbox.digestSubsGet()
      .then((resp) => {
        const me = (resp.records as any[]).find((r: any) => r.uid === user.uid);
        if (me) setSubscribed(!!(me.effective as any)[digestType]);
      })
      .catch(() => {/* silent */});
  }, [user?.uid, digestType]);

  const toggle = async () => {
    if (!user?.uid || busy) return;
    const next = !subscribed;
    setBusy(true);
    try {
      await Inbox.digestSubUpdate({ uid: user.uid, digestType, subscribed: next });
      setSubscribed(next);
      toast(next ? "Subscribed to digest." : "Unsubscribed from digest.", { type: "success" });
    } catch (e: any) {
      toast(e?.message || "Failed to update subscription.", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (subscribed === null) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={subscribed ? "Unsubscribe from monthly digest email" : "Subscribe to monthly digest email"}
      className={[
        "btn btn-xs border text-xs font-semibold",
        subscribed
          ? "bg-green-100 border-green-300 text-green-700 hover:bg-green-200"
          : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100",
      ].join(" ")}
    >
      {busy ? "…" : subscribed ? "✓ Subscribed" : "Subscribe to Digest"}
    </button>
  );
}

export function ToolTopbarRow({ tool, filterState, setFilterState, selection, navStack, nav }: ToolTopbarRowProps) {
  const Topbar = tool.ToolTopbar;
  const isInboxTool = tool.id === "inbox";
  const hideTitle = isInboxTool || !!tool.hideTopbarTitle;
  const shellClassName = "border-b border-slate-300 bg-slate-100 px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80";
  const controlsClassName = "flex flex-1 flex-wrap items-center gap-2";

  if (hideTitle) {
    return (
      <div className={shellClassName}>
        <div className={controlsClassName}>
          {Topbar ? (
            <Topbar
              value={filterState}
              onChange={setFilterState}
              selection={selection}
              nav={{ stack: navStack, push: nav.push, pop: nav.pop, reset: nav.reset, setStack: nav.setStack }}
            />
          ) : (
            <div className="text-xs text-slate-600">No tool-specific filters</div>
          )}
          {tool.digestType && <DigestSubscribeButton digestType={tool.digestType} />}
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-slate-950 dark:text-slate-100">{tool.title}</span>
          {navStack.length ? <span>/</span> : null}
          {navStack.map((c) => (
            <span key={c.key} className="truncate">
              {c.label}
            </span>
          ))}
          {navStack.length ? (
            <button className="btn btn-ghost btn-xs border-slate-300 bg-white/80 hover:bg-white" onClick={nav.pop}>
              Back
            </button>
          ) : null}
          {tool.digestType && <DigestSubscribeButton digestType={tool.digestType} />}
        </div>
        <div className={controlsClassName}>
          {Topbar ? (
            <Topbar
              value={filterState}
              onChange={setFilterState}
              selection={selection}
              nav={{ stack: navStack, push: nav.push, pop: nav.pop, reset: nav.reset, setStack: nav.setStack }}
            />
          ) : (
            <div className="text-xs text-slate-600">No tool-specific filters</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ToolTopbarRow;
