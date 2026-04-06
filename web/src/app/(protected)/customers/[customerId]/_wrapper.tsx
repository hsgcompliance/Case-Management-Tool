"use client";
import dynamic from "next/dynamic";
const CustomerFullPageClient = dynamic(() => import("./_client"), );
export default function CustomerFullPageWrapper() {
  return <CustomerFullPageClient />;
}
