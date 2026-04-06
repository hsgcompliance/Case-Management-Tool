// BEGIN FILE: src/app/(protected)/customers/@modal/(.)[customerId]/page.tsx
import CustomersModalWrapper from "./_wrapper";

export function generateStaticParams() { return []; }

export default function CustomersModalRoute() {
  return <CustomersModalWrapper />;
}
