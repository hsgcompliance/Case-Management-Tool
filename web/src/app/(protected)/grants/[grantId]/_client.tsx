"use client";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@app/auth/AuthProvider";
import { isAdminLike } from "@lib/roles";
import GrantDetailModal from "@features/grants/GrantModal";

export default function GrantDetailPageClient() {
  const router = useRouter();
  const { grantId } = useParams<{ grantId: string }>();
  const { profile } = useAuth();
  const canAdmin = isAdminLike(profile as { topRole?: unknown; role?: unknown } | null);
  return (
    <div className="mx-auto max-w-5xl p-6">
      <GrantDetailModal
        grantId={grantId}
        canAdminDelete={canAdmin}
        onClose={() => router.push("/budget")}
      />
    </div>
  );
}
