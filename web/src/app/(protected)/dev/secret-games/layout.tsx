import type React from "react";
import SecretGamesSandboxLayout from "@features/dev/secret-games/SecretGamesSandboxLayout";

export default function DevSecretGamesLayout({ children }: { children: React.ReactNode }) {
  return <SecretGamesSandboxLayout>{children}</SecretGamesSandboxLayout>;
}
