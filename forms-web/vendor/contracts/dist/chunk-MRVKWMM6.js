import {
  BoolFromLike,
  Id,
  Ids,
  TsLike,
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/tours.ts
var tours_exports = {};
__export(tours_exports, {
  TourFlow: () => TourFlow,
  TourStep: () => TourStep,
  ToursDeleteBody: () => ToursDeleteBody,
  ToursGetQuery: () => ToursGetQuery,
  ToursListQuery: () => ToursListQuery,
  ToursPatchBody: () => ToursPatchBody,
  ToursPatchItem: () => ToursPatchItem,
  ToursUpsertBody: () => ToursUpsertBody
});
var TourStep = z.object({
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
  advanceWhen: z.string().optional()
});
var TourFlow = z.object({
  id: Id,
  name: z.string().trim().min(1),
  steps: z.array(TourStep),
  updatedAt: TsLike.optional(),
  // <-- core timestamp-like
  version: z.literal(2).default(2),
  active: z.boolean().default(true),
  deleted: z.boolean().default(false),
  meta: z.record(z.string(), z.unknown()).default({})
  // <-- no optional+default combo
});
var ToursUpsertBody = z.union([TourFlow, z.array(TourFlow)]);
var ToursPatchItem = z.object({
  id: Id,
  data: z.record(z.string(), z.unknown()).refine((v) => v && Object.keys(v).length > 0, "data must have fields")
});
var ToursPatchBody = z.union([ToursPatchItem, z.array(ToursPatchItem)]);
var ToursDeleteBody = z.union([
  Id,
  Ids,
  z.object({ id: Id }),
  z.object({ ids: Ids })
]);
var ToursGetQuery = z.object({ id: Id });
var ToursListQuery = z.object({
  active: BoolFromLike.optional(),
  // <-- better query semantics, from core
  deleted: BoolFromLike.optional(),
  limit: z.union([z.number(), z.string()]).optional(),
  startAfter: z.string().optional(),
  version: z.union([z.number(), z.string()]).optional()
});

export {
  TourStep,
  TourFlow,
  ToursUpsertBody,
  ToursPatchItem,
  ToursPatchBody,
  ToursDeleteBody,
  ToursGetQuery,
  ToursListQuery,
  tours_exports
};
