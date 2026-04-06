// app/(protected)/admin/layout.tsx
import React from "react";
import RequireAdmin from "../../_guards/RequireAdmin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
