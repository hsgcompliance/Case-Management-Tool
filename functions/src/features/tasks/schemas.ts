// functions/src/features/tasks/schemas.ts
import { tasks as T, z } from "@hdb/contracts";
export { z };

// Runtime schemas (no deep imports)
export const AssignedGroup = T.AssignedGroup;
export const TaskScheduleItem = T.TaskScheduleItem;
export const TaskStats = T.TaskStats;
export const TasksBulkStatusBody = T.TasksBulkStatusBody;
export const TasksAssignBody = T.TasksAssignBody;
export const TasksUpdateFieldsBody = T.TasksUpdateFieldsBody;
export const TasksUpdateStatusBody = T.TasksUpdateStatusBody;
export const TasksDeleteBody = T.TasksDeleteBody;
export const TasksListQuery = T.TasksListQuery;
export const TasksRescheduleBody = T.TasksRescheduleBody;
export const TasksUpsertManualBody = T.TasksUpsertManualBody;
export const TasksAdminRegenerateForGrantBody = T.TasksAdminRegenerateForGrantBody;
export const TasksGenerateScheduleWriteBody = T.TasksGenerateScheduleWriteBody;

// Types (top-level)
export type {
  TTaskScheduleItem,
  TTaskStats,
  TAssignedGroup,
  TTasksBulkStatusBody,
  TTasksAssignBody,
  TTasksUpdateFieldsBody,
  TTasksUpdateStatusBody,
  TTasksDeleteBody,
  TTasksListQuery,
  TTasksRescheduleBody,
  TTasksUpsertManualBody,
  TTasksAdminRegenerateForGrantBody,
  TTasksGenerateScheduleWriteBody,
  TTasksGenerateScheduleWriteResult,
  TTasksListItem,
} from "@hdb/contracts";