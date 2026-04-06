"use client";
import dynamic from "next/dynamic";
const CustomerModalOnCaseManagersClient = dynamic(() => import("./_client"), );
export default function CustomerModalOnCaseManagersWrapper() {
  return <CustomerModalOnCaseManagersClient />;
}
