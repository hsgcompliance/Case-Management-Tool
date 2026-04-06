"use client";
import { useParams, useRouter } from "next/navigation";
import GrantDetailModal from "@features/grants/GrantModal";

export default function GrantDetailPageClient() {
  const router = useRouter();
  const { grantId } = useParams<{ grantId: string }>();
  return (
    <div className="mx-auto max-w-5xl p-6">
      <GrantDetailModal
        grantId={grantId}
        canAdminDelete={false}
        onClose={() => router.push("/grants")}
      />
    </div>
  );
}
