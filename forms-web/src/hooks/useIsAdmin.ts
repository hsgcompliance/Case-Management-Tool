import { useEffect, useState } from "react";
import { getFormsAuthInfo } from "@/lib/formsRegistryApi";

/** Whether the signed-in staff user is an admin (server-checked). */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getFormsAuthInfo()
      .then((r) => { if (alive) setIsAdmin(!!r.isAdmin); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return { isAdmin, loading };
}
