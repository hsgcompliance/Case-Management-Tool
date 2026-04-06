// BEGIN FILE: src/app/(protected)/customers/[customerId]/page.tsx
import CustomerFullPageWrapper from "./_wrapper";

export function generateStaticParams() { return []; }

export default function CustomerFullPage() {
  return <CustomerFullPageWrapper />;
}
