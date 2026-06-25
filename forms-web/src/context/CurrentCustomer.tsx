import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FormsCustomer } from "@/lib/customersApi";

// The "current session customer" — selected via the top search bar, used to scope
// / prefill forms. Persisted to localStorage so it survives reloads.

type Ctx = {
  customer: FormsCustomer | null;
  setCustomer: (c: FormsCustomer | null) => void;
};

const CurrentCustomerContext = createContext<Ctx>({ customer: null, setCustomer: () => {} });

const STORAGE_KEY = "hdb:forms:current-customer";

export function CurrentCustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomerState] = useState<FormsCustomer | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as FormsCustomer) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (customer) localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [customer]);

  const value = useMemo<Ctx>(() => ({ customer, setCustomer: setCustomerState }), [customer]);
  return <CurrentCustomerContext.Provider value={value}>{children}</CurrentCustomerContext.Provider>;
}

export function useCurrentCustomer() {
  return useContext(CurrentCustomerContext);
}
