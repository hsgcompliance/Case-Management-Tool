// src/app/(protected)/customers/layout.tsx
import React from "react";

export default function CustomersLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  // Keep the background list page mounted while the modal slot renders on top
  return (
    <>
      {children}
      {modal}
    </>
  );
}
