//web/src/tours/schema.ts
import { z } from "zod";

export const TourStep = z.object({
  id: z.string(),
  route: z.string(),                 // absolute pathname
  selector: z.string().optional(),   // CSS or [data-tour="..."]
  title: z.string().optional(),
  body: z.string().optional(),
  placement: z.enum(["auto","top","bottom","left","right"]).optional().default("auto"),
  padding: z.number().int().nonnegative().optional().default(8),
  offsetX: z.number().optional().default(0),
  offsetY: z.number().optional().default(0),
  requireClick: z.boolean().optional().default(false),
});

export const TourFlow = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(TourStep),
  updatedAt: z.string().optional(),
  version: z.literal(2).default(2),
});

export type TourStepT = z.infer<typeof TourStep>;
export type TourFlowT = z.infer<typeof TourFlow>;