"use client";

import RequireSuperDev from "@app/_guards/RequireSuperDev";
import OrgManagerTool from "@features/dev/OrgManagerTool";

export default function OrgManagerPage() {
  return (
    <RequireSuperDev>
      <OrgManagerTool />
    </RequireSuperDev>
  );
}

