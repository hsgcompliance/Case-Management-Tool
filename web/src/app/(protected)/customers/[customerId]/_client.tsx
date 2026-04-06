"use client";
import React from "react";
import { useRouter, useParams } from "next/navigation";
import CustomersModal from "@features/customers/CustomersModal";

export default function CustomerFullPageClient() {
  const router = useRouter();
  const { customerId } = useParams<{ customerId: string }>();
  const isNew = !customerId || customerId === "new";

  return (
    <div>
      {/* Back bar — visible whenever this page renders outside the modal interceptor */}
      <div
        className="sticky z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90"
        style={{ top: "var(--topbar-height)" }}
      >
        <button
          type="button"
          onClick={() => router.push("/customers")}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <span className="text-base leading-none">←</span>
          Customers
        </button>

        <span className="text-xs text-slate-400 dark:text-slate-500">
          {isNew ? "New Customer" : `Customer ${customerId}`}
        </span>

        <button
          type="button"
          onClick={() => router.push("/customers")}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Close — return to Customers"
        >
          ✕
        </button>
      </div>

      <div className="mx-auto max-w-5xl p-6">
        <CustomersModal
          customerId={customerId}
          onClose={() => router.push("/customers")}
          pageMode
        />
      </div>
    </div>
  );
}
