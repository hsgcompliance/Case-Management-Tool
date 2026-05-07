"use client";

import React from "react";
import {
  FAKE_CASE_MANAGERS,
  FAKE_CASE_MANAGER_OPTIONS,
  FAKE_CUSTOMER_ENTITIES,
  FAKE_CUSTOMERS,
  SANDBOX_ALL_CASE_MANAGERS,
  type FakeCaseManager,
  type FakeCustomerRecord,
} from "./fixtures";
import type { TCustomerEntity } from "@types";
import type { CaseManagerOption } from "@entities/selectors/CaseManagerSelect";

type SecretGamesSandboxValue = {
  caseManagers: FakeCaseManager[];
  caseManagerOptions: CaseManagerOption[];
  customers: FakeCustomerRecord[];
  customerEntities: TCustomerEntity[];
  visibleCustomers: FakeCustomerRecord[];
  visibleCustomerEntities: TCustomerEntity[];
  activeCaseManagerId: string;
  activeCaseManager: FakeCaseManager | null;
  setActiveCaseManagerId: (next: string) => void;
  /** When true, the lab page shows real Firestore customers instead of sandbox fixtures. */
  useRealCustomers: boolean;
  setUseRealCustomers: (next: boolean) => void;
};

const SecretGamesSandboxCtx = React.createContext<SecretGamesSandboxValue | null>(null);

export function SecretGamesSandboxProvider({ children }: { children: React.ReactNode }) {
  const [activeCaseManagerId, setActiveCaseManagerId] = React.useState<string>(SANDBOX_ALL_CASE_MANAGERS);
  const [useRealCustomers, setUseRealCustomers] = React.useState<boolean>(true);

  const activeCaseManager = React.useMemo(
    () => FAKE_CASE_MANAGERS.find((manager) => manager.id === activeCaseManagerId) || null,
    [activeCaseManagerId],
  );

  const visibleCustomers = React.useMemo(() => {
    if (activeCaseManagerId === SANDBOX_ALL_CASE_MANAGERS) return FAKE_CUSTOMERS;
    return FAKE_CUSTOMERS.filter((customer) => customer.caseManagerId === activeCaseManagerId);
  }, [activeCaseManagerId]);

  const visibleCustomerEntities = React.useMemo(() => {
    if (activeCaseManagerId === SANDBOX_ALL_CASE_MANAGERS) return FAKE_CUSTOMER_ENTITIES;
    return FAKE_CUSTOMER_ENTITIES.filter((customer) => customer.caseManagerId === activeCaseManagerId);
  }, [activeCaseManagerId]);

  const value = React.useMemo<SecretGamesSandboxValue>(
    () => ({
      caseManagers: FAKE_CASE_MANAGERS,
      caseManagerOptions: FAKE_CASE_MANAGER_OPTIONS,
      customers: FAKE_CUSTOMERS,
      customerEntities: FAKE_CUSTOMER_ENTITIES,
      visibleCustomers,
      visibleCustomerEntities,
      activeCaseManagerId,
      activeCaseManager,
      setActiveCaseManagerId,
      useRealCustomers,
      setUseRealCustomers,
    }),
    [activeCaseManager, activeCaseManagerId, visibleCustomerEntities, visibleCustomers, useRealCustomers],
  );

  return <SecretGamesSandboxCtx.Provider value={value}>{children}</SecretGamesSandboxCtx.Provider>;
}

export function useSecretGamesSandbox() {
  const ctx = React.useContext(SecretGamesSandboxCtx);
  if (!ctx) throw new Error("useSecretGamesSandbox must be used inside SecretGamesSandboxProvider");
  return ctx;
}
