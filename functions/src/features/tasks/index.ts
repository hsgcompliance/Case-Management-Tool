// functions/src/features/tasks/index.ts
import { secureHandler } from "../../core";

// Handlers
import { generateTaskScheduleWriteHandler } from "./generateScheduleWrite";
import { assignTaskHandler } from "./assign";
import { updateTaskFieldsHandler } from "./updateFields";
import { updateTaskStatusHandler } from "./updateStatus";
import { deleteTaskHandler } from "./delete";
import { adminRegenerateTasksForGrantHandler } from "./adminRegenerateForGrant";
import { tasksBulkStatus } from "./bulkStatus";
import { tasksList } from "./list";
import { tasksReschedule } from "./reschedule";
import { tasksUpsertManual } from "./upsertManual";

import {
  createOtherTask,
  updateOtherTask,
  assignOtherTask,
  updateOtherTaskStatus,
  listMyOtherTasks,
} from "./other";

// Public surface (Cloud Functions v2 HTTPS)
// Each wrapper is Promise<void> and does not return Response objects.

export const tasksGenerateScheduleWrite = secureHandler(
  async (req, res): Promise<void> => {
    await generateTaskScheduleWriteHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

export const tasksAssign = secureHandler(
  async (req, res): Promise<void> => {
    await assignTaskHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

export const tasksUpdateFields = secureHandler(
  async (req, res): Promise<void> => {
    await updateTaskFieldsHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

export const tasksUpdateStatus = secureHandler(
  async (req, res): Promise<void> => {
    await updateTaskStatusHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

export const tasksDelete = secureHandler(
  async (req, res): Promise<void> => {
    await deleteTaskHandler(req as any, res as any);
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

export const tasksAdminRegenerateForGrant = secureHandler(
  async (req, res): Promise<void> => {
    await adminRegenerateTasksForGrantHandler(req as any, res as any);
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

// New routes (already wrapped)
export { tasksBulkStatus, tasksList, tasksReschedule, tasksUpsertManual };

// Firestore triggers
export { onEnrollmentBuildTasks, onEnrollmentAutoAssignCM, onOtherTaskWrite } from "./triggers";

// Other tasks collection routes
export const tasksOtherCreate = createOtherTask;
export const tasksOtherUpdate = updateOtherTask;
export const tasksOtherAssign = assignOtherTask;
export const tasksOtherStatus = updateOtherTaskStatus;
export const tasksOtherListMy = listMyOtherTasks;
