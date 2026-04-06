//src/features/customers/tabs/CustomerFilesTab.tsx
"use client";

import React from "react";
import { CustomerFilesPanel } from "../components";

export function CustomerFilesTab({ customerId }: { customerId: string }) {
  return <CustomerFilesPanel customerId={customerId} />;
}

export default CustomerFilesTab;
