import { describe, expect, it } from "vitest";
import { defaultGrantDriveTemplateKeys, grantDriveTemplates, parseDriveFileId } from "./driveTemplates";

describe("grant Drive templates", () => {
  it("extracts Drive file ids from common Google Docs and Sheets URLs", () => {
    expect(parseDriveFileId("https://docs.google.com/document/d/docTemplate123456789012345/edit")).toBe("docTemplate123456789012345");
    expect(parseDriveFileId("https://docs.google.com/spreadsheets/d/sheetTemplate1234567890123/edit#gid=0")).toBe("sheetTemplate1234567890123");
    expect(parseDriveFileId("rawTemplate123456789012345")).toBe("rawTemplate123456789012345");
  });

  it("normalizes configured templates and returns default keys", () => {
    const templates = grantDriveTemplates({
      driveTemplates: [
        {
          key: "lease",
          label: "Lease Template",
          fileUrl: "https://docs.google.com/document/d/docTemplate123456789012345/edit",
        },
        {
          key: "budget",
          label: "Budget Sheet",
          fileId: "sheetTemplate1234567890123",
          defaultChecked: false,
        },
      ],
    });

    expect(templates).toHaveLength(2);
    expect(templates[0]).toMatchObject({ key: "lease", fileId: "docTemplate123456789012345", type: "doc" });
    expect(defaultGrantDriveTemplateKeys({ driveTemplates: templates })).toEqual(["lease"]);
  });
});
