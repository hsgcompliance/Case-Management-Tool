// app/(protected)/casemanagers/layout.tsx
import React from "react";
export default function CaseManagersLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
