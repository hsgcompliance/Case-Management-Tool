// web/src/hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Tasks from "@client/tasks";
import { qk } from "./queryKeys";
import { RQ_DEFAULTS } from "./base";
import type { ReqOf, RespOf } from "@types";
import { reassignDebugLog } from "@lib/reassignDebug";

// Intentional: task queues are highly dynamic and should refresh aggressively.
const TASKS_OTHER_STALE_MS = 0;
const TASKS_LIST_STALE_MS = 10_000;

// UI-friendly filters (booleans), converted to contracts query ("true"|"false")
export type MyOtherTasksFiltersUI = {
  month?: string; // YYYY-MM
  includeGroup?: boolean;
};

function toOtherListQuery(filters?: MyOtherTasksFiltersUI): ReqOf<"tasksOtherListMy"> | undefined {
  if (!filters) return undefined;
  return {
    month: filters.month,
    includeGroup:
      filters.includeGroup === undefined ? undefined : filters.includeGroup ? "true" : "false",
  };
}

type OtherTasksResp = RespOf<"tasksOtherListMy">;
type OtherTaskItem = OtherTasksResp extends { items: Array<infer I> } ? I : Record<string, unknown>;

export function useMyOtherTasks(
  filters?: MyOtherTasksFiltersUI,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = opts?.enabled ?? true;

  return useQuery<OtherTaskItem[]>({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.tasks.myOther(filters),
    queryFn: async () => {
      const resp = await Tasks.other.listMy(toOtherListQuery(filters));
      if (resp && typeof resp === "object") {
        const items = (resp as { items?: unknown }).items;
        if (Array.isArray(items)) return items as OtherTaskItem[];
      }
      return [];
    },
    staleTime: opts?.staleTime ?? TASKS_OTHER_STALE_MS,
  });
}

type TasksListResp = RespOf<"tasksList">;
export type TasksListItem = TasksListResp extends { items: Array<infer I> } ? I : Record<string, unknown>;

async function invalidateTaskRelated(qc: ReturnType<typeof useQueryClient>) {
  reassignDebugLog("tasks-cache", "invalidate:start");
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.tasks.root }),
    qc.invalidateQueries({ queryKey: qk.enrollments.root }),
    qc.invalidateQueries({ queryKey: qk.users.me() }),
  ]);
  await qc.invalidateQueries({ queryKey: qk.inbox.root });
  reassignDebugLog("tasks-cache", "invalidate:done");
}

async function invalidateTaskRelatedWithDelayedInbox(
  qc: ReturnType<typeof useQueryClient>,
  delayMs = 1500
) {
  reassignDebugLog("tasks-cache", "invalidate-delayed-inbox:start", { delayMs });
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.tasks.root }),
    qc.invalidateQueries({ queryKey: qk.enrollments.root }),
    qc.invalidateQueries({ queryKey: qk.users.me() }),
  ]);
  setTimeout(() => {
    void qc.invalidateQueries({ queryKey: qk.inbox.root });
    reassignDebugLog("tasks-cache", "invalidate-delayed-inbox:inbox-refetch", { delayMs });
  }, Math.max(0, delayMs));
}

type StatusAction = "complete" | "reopen";
type Snap = Array<{ key: readonly unknown[]; prev: unknown }>;

function toTargetStatus(action: StatusAction): "open" | "done" {
  return action === "complete" ? "done" : "open";
}

function queryStatusFilter(queryKey: readonly unknown[]): "open" | "done" | null {
  if (!Array.isArray(queryKey) || queryKey.length < 3) return null;
  const filters = queryKey[2];
  if (!filters || typeof filters !== "object") return null;
  const raw = (filters as Record<string, unknown>).status;
  if (raw === "open" || raw === "done") return raw;
  return null;
}

function patchStatusItem(item: any, nextStatus: "open" | "done", nowIso: string) {
  const base = { ...(item || {}) };
  base.status = nextStatus;
  base.completed = nextStatus === "done";
  base.completedAtISO = nextStatus === "done" ? nowIso : null;
  if ("completedAt" in base) base.completedAt = nextStatus === "done" ? nowIso : null;
  return base;
}

function patchCollectionByStatus(
  data: unknown,
  match: (item: any) => boolean,
  nextStatus: "open" | "done",
  statusFilter: "open" | "done" | null,
  nowIso: string
): { changed: boolean; next: unknown } {
  let changed = false;
  const patchArr = (arr: any[]) => {
    const next: any[] = [];
    for (const item of arr) {
      if (!match(item)) {
        next.push(item);
        continue;
      }
      const patched = patchStatusItem(item, nextStatus, nowIso);
      if (statusFilter && statusFilter !== nextStatus) {
        changed = true;
        continue;
      }
      changed = true;
      next.push(patched);
    }
    return next;
  };

  if (Array.isArray(data)) {
    return { changed, next: patchArr(data) };
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) {
      const items = patchArr(obj.items as any[]);
      return { changed, next: changed ? { ...obj, items } : data };
    }
    if (obj.data && typeof obj.data === "object" && Array.isArray((obj.data as any).items)) {
      const nested = obj.data as Record<string, unknown>;
      const items = patchArr((nested.items as any[]) || []);
      return { changed, next: changed ? { ...obj, data: { ...nested, items } } : data };
    }
  }

  return { changed: false, next: data };
}

function applyOptimisticInboxStatusPatch(
  qc: ReturnType<typeof useQueryClient>,
  action: StatusAction,
  match: (item: any) => boolean,
  label: string
): Snap {
  const nextStatus = toTargetStatus(action);
  const nowIso = new Date().toISOString();
  const snaps: Snap = [];
  const queries = qc.getQueriesData({ queryKey: qk.inbox.root });

  for (const [key, data] of queries) {
    if (!Array.isArray(key) || key.length < 2) continue;
    const root = String(key[0] || "");
    const scope = String(key[1] || "");
    if (root !== "inbox") continue;
    if (scope !== "my" && scope !== "workload") continue;

    const statusFilter = queryStatusFilter(key as readonly unknown[]);
    const patched = patchCollectionByStatus(data, match, nextStatus, statusFilter, nowIso);
    if (!patched.changed) continue;

    snaps.push({ key: key as readonly unknown[], prev: data });
    qc.setQueryData(key, patched.next);
  }

  reassignDebugLog("tasks-cache", "optimistic-status-patch", {
    label,
    action,
    nextStatus,
    touched: snaps.length,
  });
  return snaps;
}

function restoreInboxSnapshots(qc: ReturnType<typeof useQueryClient>, snaps?: Snap) {
  if (!snaps?.length) return;
  for (const s of snaps) qc.setQueryData(s.key, s.prev);
  reassignDebugLog("tasks-cache", "optimistic-status-rollback", { touched: snaps.length });
}

function applyOptimisticTasksListStatusPatch(
  qc: ReturnType<typeof useQueryClient>,
  action: StatusAction,
  match: (item: any) => boolean,
  label: string
): Snap {
  const nextStatus = toTargetStatus(action);
  const nowIso = new Date().toISOString();
  const snaps: Snap = [];
  const queries = qc.getQueriesData({ queryKey: qk.tasks.root });

  for (const [key, data] of queries) {
    if (!Array.isArray(key) || key.length < 2) continue;
    const root = String(key[0] || "");
    const scope = String(key[1] || "");
    if (root !== "tasks") continue;
    if (scope !== "list" && !(scope === "other" && String(key[2] || "") === "my")) continue;

    const statusFilter = queryStatusFilter(key as readonly unknown[]);
    const patched = patchCollectionByStatus(data, match, nextStatus, statusFilter, nowIso);
    if (!patched.changed) continue;

    snaps.push({ key: key as readonly unknown[], prev: data });
    qc.setQueryData(key, patched.next);
  }

  reassignDebugLog("tasks-cache", "optimistic-task-list-status-patch", {
    label,
    action,
    nextStatus,
    touched: snaps.length,
  });
  return snaps;
}

export function useTasksForEnrollments(
  enrollmentIds: string[],
  dueMonth: string,
  opts?: { enabled?: boolean; assigneeUid?: string; limit?: number }
) {
  const ids = enrollmentIds.filter(Boolean);
  const assigneeUid = String(opts?.assigneeUid || "").trim() || undefined;
  const limit = Math.max(1, Math.min(1000, Number(opts?.limit || 50)));
  return useQuery<TasksListItem[]>({
    ...RQ_DEFAULTS,
    staleTime: TASKS_LIST_STALE_MS,
    enabled: (opts?.enabled ?? true) && ids.length > 0,
    queryKey: qk.tasks.list({ enrollmentIds: [...ids].sort(), dueMonth, assigneeUid, limit }),
    queryFn: async () => {
      const resp = await Tasks.list({ enrollmentIds: ids, dueMonth, assigneeUid, limit });
      if (resp && typeof resp === "object" && Array.isArray((resp as { items?: unknown[] }).items)) {
        return ((resp as { items?: unknown[] }).items || []) as TasksListItem[];
      }
      return [];
    },
  });
}

export function useTasksList(
  filters: ReqOf<"tasksList"> | undefined,
  opts?: { enabled?: boolean; staleTime?: number }
) {
  const enabled = (opts?.enabled ?? true) && !!filters;
  return useQuery<TasksListItem[]>({
    ...RQ_DEFAULTS,
    enabled,
    queryKey: qk.tasks.list(filters || {}),
    queryFn: async () => {
      const resp = await Tasks.list((filters || {}) as ReqOf<"tasksList">);
      if (resp && typeof resp === "object" && Array.isArray((resp as { items?: unknown[] }).items)) {
        return ((resp as { items?: unknown[] }).items || []) as TasksListItem[];
      }
      return [];
    },
    staleTime: opts?.staleTime ?? TASKS_LIST_STALE_MS,
  });
}

export function useTasksUpsertManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"tasksUpsertManual">) => Tasks.upsertManual(body),
    onSuccess: async () => invalidateTaskRelated(qc),
  });
}

export function useTasksGenerateScheduleWrite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"tasksGenerateScheduleWrite">) => Tasks.generateScheduleWrite(body),
    onSuccess: async () => invalidateTaskRelated(qc),
  });
}

export function useTasksAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ReqOf<"tasksAssign">) => {
      reassignDebugLog("useTasksAssign", "request", body);
      const res = await Tasks.assign(body);
      reassignDebugLog("useTasksAssign", "response", res);
      return res;
    },
    onSuccess: async () => invalidateTaskRelated(qc),
    onError: (err, vars) => {
      reassignDebugLog("useTasksAssign", "error", {
        request: vars,
        message: (err as any)?.message || "unknown",
        meta: (err as any)?.meta || null,
      });
    },
  });
}

export function useTasksUpdateFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"tasksUpdateFields">) => Tasks.updateFields(body),
    onSuccess: async () => invalidateTaskRelated(qc),
  });
}

export function useTasksUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"tasksUpdateStatus">) => Tasks.updateStatus(body),
    onMutate: async (body) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: qk.inbox.root }),
        qc.cancelQueries({ queryKey: qk.tasks.root }),
      ]);
      const enrollmentId = String((body as any)?.enrollmentId || "");
      const taskId = String((body as any)?.taskId || "");
      const rawAction = String((body as any)?.action || "complete");
      if (rawAction !== "complete" && rawAction !== "reopen") {
        return { inboxSnaps: [], taskSnaps: [], action: rawAction };
      }
      const action = rawAction as StatusAction;
      const utid = `task|${enrollmentId}|${taskId}`;
      const sourcePath = `customerEnrollments/${enrollmentId}#taskSchedule:${taskId}`;
      const inboxSnaps = applyOptimisticInboxStatusPatch(
        qc,
        action,
        (item) => String(item?.utid || item?.id || "") === utid || String(item?.sourcePath || "") === sourcePath,
        "tasksUpdateStatus"
      );
      const taskSnaps = applyOptimisticTasksListStatusPatch(
        qc,
        action,
        (item) =>
          String(item?.id || "") === taskId ||
          String(item?.taskId || "") === taskId ||
          String(item?.sourceTaskId || "") === taskId,
        "tasksUpdateStatus"
      );
      return { inboxSnaps, taskSnaps, action };
    },
    onError: (_err, _vars, ctx) => {
      restoreInboxSnapshots(qc, (ctx as any)?.inboxSnaps);
      restoreInboxSnapshots(qc, (ctx as any)?.taskSnaps);
      void invalidateTaskRelated(qc);
    },
    onSuccess: async (_res, body, ctx) => {
      const action = String((body as any)?.action || (ctx as any)?.action || "");
      if (action === "complete" || action === "reopen") {
        // Optimistic patch already applied; schedule a background reconciliation
        // after trigger latency (cold-start can be 3-5 s) to correct any drift.
        setTimeout(() => void invalidateTaskRelatedWithDelayedInbox(qc, 0), 4000);
        return;
      }
      await invalidateTaskRelatedWithDelayedInbox(qc, 1500);
    },
  });
}

export function useTasksDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"tasksDelete">) => Tasks.delete(body),
    onSuccess: async () => invalidateTaskRelated(qc),
  });
}

export function useTasksReschedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"tasksReschedule">) => Tasks.reschedule(body),
    onSuccess: async () => invalidateTaskRelated(qc),
  });
}

export function useTasksAdminRegenerateForGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReqOf<"tasksAdminRegenerateForGrant">) => Tasks.adminRegenerateForGrant(body),
    onSuccess: async () => {
      await Promise.all([
        invalidateTaskRelated(qc),
        qc.invalidateQueries({ queryKey: qk.grants.root }),
      ]);
    },
  });
}

// Other-task namespace
export function useTaskOtherCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ReqOf<"tasksOtherCreate">) => Tasks.other.create(b),
    onSuccess: async () => invalidateTaskRelated(qc),
  });
}
export function useTaskOtherUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ReqOf<"tasksOtherUpdate">) => Tasks.other.update(b),
    onSuccess: async () => invalidateTaskRelated(qc),
  });
}
export function useTaskOtherAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: ReqOf<"tasksOtherAssign">) => {
      reassignDebugLog("useTaskOtherAssign", "request", b);
      const res = await Tasks.other.assign(b);
      reassignDebugLog("useTaskOtherAssign", "response", res);
      return res;
    },
    onSuccess: async () => invalidateTaskRelated(qc),
    onError: (err, vars) => {
      reassignDebugLog("useTaskOtherAssign", "error", {
        request: vars,
        message: (err as any)?.message || "unknown",
        meta: (err as any)?.meta || null,
      });
    },
  });
}
export function useTaskOtherStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ReqOf<"tasksOtherStatus">) => Tasks.other.status(b),
    onMutate: async (body) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: qk.inbox.root }),
        qc.cancelQueries({ queryKey: qk.tasks.root }),
      ]);
      const otherId = String((body as any)?.id || "").trim();
      const action = ((body as any)?.action || "complete") as StatusAction;
      const inboxSnaps = applyOptimisticInboxStatusPatch(
        qc,
        action,
        (item) => {
          const utid = String(item?.utid || item?.id || "");
          const sourceId = String(item?.sourceId || "");
          const srcPath = String(item?.sourcePath || "");
          return (
            utid === otherId ||
            utid === `other|${otherId}` ||
            sourceId === otherId ||
            srcPath.includes(`otherTasks/${otherId}`)
          );
        },
        "tasksOtherStatus"
      );
      const taskSnaps = applyOptimisticTasksListStatusPatch(
        qc,
        action,
        (item) => String(item?.id || "") === otherId || String(item?.utid || "") === otherId || String(item?.utid || "") === `other|${otherId}`,
        "tasksOtherStatus"
      );
      return { inboxSnaps, taskSnaps };
    },
    onError: (_err, _vars, ctx) => {
      restoreInboxSnapshots(qc, (ctx as any)?.inboxSnaps);
      restoreInboxSnapshots(qc, (ctx as any)?.taskSnaps);
      void invalidateTaskRelated(qc);
    },
    onSuccess: async () => {
      // complete/reopen are patched optimistically for inbox + tasks lists; skip success refetch churn.
    },
  });
}
