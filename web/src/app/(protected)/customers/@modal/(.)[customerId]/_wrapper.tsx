"use client";
import dynamic from "next/dynamic";
const CustomersModalRouteClient = dynamic(() => import("./_client"), );
export default function CustomersModalWrapper() {
  return <CustomersModalRouteClient />;
}
