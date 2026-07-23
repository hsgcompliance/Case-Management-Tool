import { describe, expect, it } from "vitest";
import { getCustomerDriveFolderLink } from "./customerDriveFolder";

const CANONICAL_ID = "1CanonicalDriveFolderId123456";
const LEGACY_ID = "1LegacyDriveFolderId123456789";

describe("getCustomerDriveFolderLink", () => {
  it("uses the canonical customerDrive folder for the header link", () => {
    expect(
      getCustomerDriveFolderLink({
        customerDrive: {
          folderId: CANONICAL_ID,
          folderName: "Customer Documents",
        },
        meta: {
          driveFolders: [{ id: LEGACY_ID, name: "Old Folder" }],
        },
      }),
    ).toEqual({
      url: `https://drive.google.com/drive/folders/${CANONICAL_ID}`,
      label: "Customer Documents",
    });
  });

  it("continues to resolve legacy linked folders", () => {
    expect(
      getCustomerDriveFolderLink({
        meta: {
          driveFolders: [{ id: LEGACY_ID, alias: "Case Files" }],
        },
      }),
    ).toEqual({
      url: `https://drive.google.com/drive/folders/${LEGACY_ID}`,
      label: "Case Files",
    });
  });

  it("returns null until a Drive folder is linked", () => {
    expect(getCustomerDriveFolderLink({ id: "customer-1" })).toBeNull();
  });
});
