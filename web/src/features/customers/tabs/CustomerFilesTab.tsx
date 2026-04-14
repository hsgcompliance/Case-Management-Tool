//src/features/customers/tabs/CustomerFilesTab.tsx
"use client";

import React from "react";
import { CustomerIntegrationsPanel } from "../components/CustomerIntegrationsPanel";

export function CustomerFilesTab({ customerId }: { customerId: string }) {
  return <CustomerIntegrationsPanel customerId={customerId} />;
}

export default CustomerFilesTab;
