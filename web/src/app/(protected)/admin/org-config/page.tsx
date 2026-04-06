"use client";

import RequireAdmin from "@app/_guards/RequireAdmin";
import OrgConfigPage from "@features/admin/OrgConfigPage";

export default function OrgConfigRoute() {
  return (
    <RequireAdmin>
      <OrgConfigPage />
    </RequireAdmin>
  );
}
