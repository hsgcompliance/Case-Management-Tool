// app/(protected)/grants/[grantId]/page.tsx
import GrantDetailPageWrapper from "./_wrapper";

export function generateStaticParams() { return []; }

export default function GrantDetailPage() {
  return <GrantDetailPageWrapper />;
}
