import { redirect } from "next/navigation";

type Props = {
  params: { grantId: string };
};

// Deprecated: grant detail pages now live in the Budget workspace modal.
export default function GrantDetailPage({ params }: Props) {
  redirect(`/budget?grantId=${encodeURIComponent(params.grantId)}`);
}
