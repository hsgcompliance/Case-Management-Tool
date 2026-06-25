import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/ui";

/** Gates staff routes. Customer token routes are NOT wrapped in this. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Checking sign-in…" />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?auto=1&next=${next}`} replace />;
  }
  return <>{children}</>;
}
