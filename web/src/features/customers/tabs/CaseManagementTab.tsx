//src/features/customers/tabs/CaseManagementTab.tsx
"use client";

import React from "react";
import { CustomerCaseManagementPanel } from "../components";

export function CaseManagementTab({ customerId }: { customerId: string }) {
  return <CustomerCaseManagementPanel customerId={customerId} />;
}

export default CaseManagementTab;
