// app/(public)/login/page.tsx
"use client";
import React from "react";
import SignInPage from "@app/auth/SignInPage";

export default function Page() {
  return (
    <React.Suspense fallback={null}>
      <SignInPage />
    </React.Suspense>
  );
}
