import { describe, expect, it } from "vitest";
import {
  enrollmentControlActionBody,
  enrollmentControlDone,
  enrollmentControlPatch,
  enrollmentControlStatusLabel,
  enrollmentControlsForGrant,
} from "./enrollmentControls";

describe("enrollmentControls", () => {
  const grant = {
    complianceConfig: {
      preset: "custom",
      active: [
        { key: "cw", label: "CW Entry", field: "compliance.caseworthyEntryComplete", type: "boolean" },
        { key: "service", label: "Service Active", field: "serviceStatus", type: "boolean" },
        { key: "medicaid", label: "Medicaid Active", field: "medicaid.status", type: "boolean" },
        { key: "custom", label: "Custom Step", field: "actions.customStep", type: "boolean" },
      ],
    },
  };

  it("normalizes mixed grant-defined enrollment controls", () => {
    const controls = enrollmentControlsForGrant(grant);

    expect(controls.map((control) => [control.kind, control.key])).toEqual([
      ["compliance", "caseworthyEntryComplete"],
      ["serviceStatus", "serviceStatus"],
      ["medicaid", "medicaidStatus"],
      ["action", "customStep"],
    ]);
  });

  it("reads status and builds the correct write body per control kind", () => {
    const [cw, service, medicaid, custom] = enrollmentControlsForGrant(grant);
    const enrollment = {
      id: "enr_1",
      compliance: { caseworthyEntryComplete: false },
      serviceStatus: "paused",
      medicaid: { status: "closed" },
      actions: { customStep: false },
    };

    expect(enrollmentControlDone(enrollment, cw)).toBe(false);
    expect(enrollmentControlPatch(enrollment, cw, true)).toEqual({
      compliance: { caseworthyEntryComplete: true },
    });

    expect(enrollmentControlStatusLabel(enrollmentControlDone(enrollment, service), service)).toBe("Paused");
    expect(enrollmentControlActionBody("enr_1", service, true)).toMatchObject({
      enrollmentId: "enr_1",
      serviceStatus: "active",
    });

    expect(enrollmentControlActionBody("enr_1", medicaid, true)).toMatchObject({
      enrollmentId: "enr_1",
      medicaid: { status: "active" },
    });

    expect(enrollmentControlActionBody("enr_1", custom, true)).toMatchObject({
      enrollmentId: "enr_1",
      actionId: "customStep",
      value: true,
    });
  });
});
