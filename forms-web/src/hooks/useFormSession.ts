import { useCallback, useEffect, useState } from "react";
import { ApiError, resolveFormSession } from "@/lib/api";
import type { TFormSessionResolved } from "@hdb/contracts";

type State = {
  loading: boolean;
  session: TFormSessionResolved | null;
  error: string | null;
  notFound: boolean;
};

export function useFormSession(token: string | undefined) {
  const [state, setState] = useState<State>({ loading: true, session: null, error: null, notFound: false });

  const load = useCallback(async () => {
    if (!token) {
      setState({ loading: false, session: null, error: "missing_token", notFound: true });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const session = await resolveFormSession(token);
      setState({ loading: false, session, error: null, notFound: false });
    } catch (e) {
      const err = e as ApiError;
      const notFound = err.status === 404 || err.status === 410;
      setState({ loading: false, session: null, error: err.message || "error", notFound });
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
