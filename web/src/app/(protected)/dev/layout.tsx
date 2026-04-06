// app/(protected)/dev/layout.tsx
import React from "react";
import RequireDev from "../../_guards/RequireDev";
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <RequireDev>{children}</RequireDev>;
}
