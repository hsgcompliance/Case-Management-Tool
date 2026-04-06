"use client";
import dynamic from "next/dynamic";
const GrantDetailPageClient = dynamic(() => import("./_client"), );
export default function GrantDetailPageWrapper() {
  return <GrantDetailPageClient />;
}
