"use client";

import React from "react";
import { SecretGamesSandboxProvider } from "./SecretGamesSandboxContext";

export default function SecretGamesSandboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <SecretGamesSandboxProvider>
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {children}
      </div>
    </SecretGamesSandboxProvider>
  );
}
