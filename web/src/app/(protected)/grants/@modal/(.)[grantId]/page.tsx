// app/(protected)/grants/@modal/(.)[grantId]/page.tsx
import GrantModalWrapper from "./_wrapper";

export function generateStaticParams() { return []; }

export default function ModalPage() {
  return <GrantModalWrapper />;
}
