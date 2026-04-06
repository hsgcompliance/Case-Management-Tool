"use client";
import dynamic from "next/dynamic";
const GrantModalClient = dynamic(() => import("./_client"), );
export default function GrantModalWrapper() {
  return <GrantModalClient />;
}
