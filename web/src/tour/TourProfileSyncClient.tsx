"use client";
// Wrapper so (protected)/layout.tsx (a Server Component) can skip TourProfileSync
// on the server. ssr:false is only valid inside Client Components in Next.js 15+.
import dynamic from "next/dynamic";
const TourProfileSync = dynamic(() => import("./TourProfileSync"), { ssr: false });
export default function TourProfileSyncClient() {
  return <TourProfileSync />;
}
