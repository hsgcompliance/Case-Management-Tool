// web/src/client/tasks.ts
import type { ReqOf, RespOf } from "@types";
import api, { type StrictEndpointName } from "./api";

const post = <N extends StrictEndpointName>(name: N, body?: ReqOf<N>) =>
  api.post(name, body) as Promise<RespOf<N>>;

const get = <N extends StrictEndpointName>(name: N, query?: ReqOf<N>) =>
  api.get(name, query) as Promise<RespOf<N>>;

const Tasks = {
  assign: (body: ReqOf<"tasksAssign">) => post("tasksAssign", body),
  updateStatus: (body: ReqOf<"tasksUpdateStatus">) => post("tasksUpdateStatus", body),
  updateFields: (body: ReqOf<"tasksUpdateFields">) => post("tasksUpdateFields", body),
  delete: (body: ReqOf<"tasksDelete">) => post("tasksDelete", body),

  bulkStatus: (body: ReqOf<"tasksBulkStatus">) => post("tasksBulkStatus", body),
  list: (body: ReqOf<"tasksList">) => post("tasksList", body),
  reschedule: (body: ReqOf<"tasksReschedule">) => post("tasksReschedule", body),
  upsertManual: (body: ReqOf<"tasksUpsertManual">) => {
    const next = { ...(body as any) };
    if (next?.task) {
      next.task = { ...next.task, notes: String(next.task.notes ?? "") };
    }
    return post("tasksUpsertManual", next);
  },

  generateScheduleWrite: (body: ReqOf<"tasksGenerateScheduleWrite">) =>
    post("tasksGenerateScheduleWrite", body),

  adminRegenerateForGrant: (body: ReqOf<"tasksAdminRegenerateForGrant">) =>
    post("tasksAdminRegenerateForGrant", body),

  other: {
    create: (body: ReqOf<"tasksOtherCreate">) => post("tasksOtherCreate", body),
    update: (body: ReqOf<"tasksOtherUpdate">) => post("tasksOtherUpdate", body),
    assign: (body: ReqOf<"tasksOtherAssign">) => post("tasksOtherAssign", body),
    status: (body: ReqOf<"tasksOtherStatus">) => post("tasksOtherStatus", body),
    listMy: (query?: ReqOf<"tasksOtherListMy">) => get("tasksOtherListMy", query),
  },
};

export default Tasks;
