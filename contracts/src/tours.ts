// contracts/src/tours.ts
import { z, Id, Ids, TsLike, BoolFromLike } from "./core";

export const TourStep = z.object({
  id: Id,
  route: z.string().trim().min(1),
  selector: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  placement: z.enum(["auto", "top", "bottom", "left", "right"]).default("auto"),
  padding: z.number().int().nonnegative().default(8),
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
  requireClick: z.boolean().default(false),
  nextOn: z.enum(["auto", "button", "click"]).default("button").optional(),
  advanceWhen: z.string().optional(),
});
export type TourStepT = z.infer<typeof TourStep>;

export const TourFlow = z.object({
  id: Id,
  name: z.string().trim().min(1),
  steps: z.array(TourStep),
  updatedAt: TsLike.optional(),            // <-- core timestamp-like
  version: z.literal(2).default(2),
  active: z.boolean().default(true),
  deleted: z.boolean().default(false),
  meta: z.record(z.string(), z.unknown()).default({}), // <-- no optional+default combo
});
export type TourFlowT = z.infer<typeof TourFlow>;

export const ToursUpsertBody = z.union([TourFlow, z.array(TourFlow)]);
export type ToursUpsertBodyT = z.infer<typeof ToursUpsertBody>;

export const ToursPatchItem = z.object({
  id: Id,
  data: z
    .record(z.string(), z.unknown())
    .refine((v) => v && Object.keys(v).length > 0, "data must have fields"),
});
export type ToursPatchItemT = z.infer<typeof ToursPatchItem>;

export const ToursPatchBody = z.union([ToursPatchItem, z.array(ToursPatchItem)]);
export type ToursPatchBodyT = z.infer<typeof ToursPatchBody>;

// DELETE bodies: handler accepts string | string[] | {id} | {ids}
export const ToursDeleteBody = z.union([
  Id,
  Ids,
  z.object({ id: Id }),
  z.object({ ids: Ids }),
]);
export type ToursDeleteBodyT = z.infer<typeof ToursDeleteBody>;

export const ToursGetQuery = z.object({ id: Id });
export type ToursGetQueryT = z.infer<typeof ToursGetQuery>;

export const ToursListQuery = z.object({
  active: BoolFromLike.optional(),   // <-- better query semantics, from core
  deleted: BoolFromLike.optional(),
  limit: z.union([z.number(), z.string()]).optional(),
  startAfter: z.string().optional(),
  version: z.union([z.number(), z.string()]).optional(),
});
export type ToursListQueryT = z.infer<typeof ToursListQuery>;
