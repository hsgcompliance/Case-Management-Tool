// src/app/(protected)/grants/layout.tsx
import React from "react";

export default function GrantsLayout({
  children,
  modal,              // parallel route slot
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal /* renders on top if present */}
    </>
  );
}
