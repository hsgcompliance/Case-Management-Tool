"use client";

import type { TCustomerEntity } from "@types";
import type { CaseManagerOption } from "@entities/selectors/CaseManagerSelect";

export type FakeCaseManager = {
  id: string;
  name: string;
  team: string;
};

export type FakeCustomerRecord = {
  id: string;
  name: string;
  population: "Youth" | "Individual" | "Family";
  householdSize: number;
  caseManagerId: string;
  acuity: number;
  status: "stable" | "watch" | "urgent";
  note: string;
};

export const SANDBOX_ALL_CASE_MANAGERS = "all";

export const FAKE_CASE_MANAGERS: FakeCaseManager[] = [
  { id: "cm-harper", name: "Harper Vale", team: "North Intake" },
  { id: "cm-otero", name: "Mina Otero", team: "Stability Team" },
  { id: "cm-nguyen", name: "Jules Nguyen", team: "Youth Outreach" },
];

export const FAKE_CUSTOMERS: FakeCustomerRecord[] = [
  {
    id: "cust-rivera",
    name: "Rivera Household",
    population: "Family",
    householdSize: 4,
    caseManagerId: "cm-harper",
    acuity: 82,
    status: "urgent",
    note: "Good fit for expanded card testing and persistent farm-state scaffolds.",
  },
  {
    id: "cust-owens",
    name: "Owens",
    population: "Individual",
    householdSize: 1,
    caseManagerId: "cm-harper",
    acuity: 54,
    status: "watch",
    note: "Compact card for inline and tight embedded layouts.",
  },
  {
    id: "cust-luna",
    name: "Luna Family",
    population: "Family",
    householdSize: 3,
    caseManagerId: "cm-otero",
    acuity: 37,
    status: "stable",
    note: "Lower-noise card for cleanup and close-state testing.",
  },
  {
    id: "cust-price",
    name: "Price",
    population: "Youth",
    householdSize: 1,
    caseManagerId: "cm-nguyen",
    acuity: 63,
    status: "watch",
    note: "Good stand-in for anomaly events and hidden trigger testing.",
  },
  {
    id: "cust-patel",
    name: "Patel Household",
    population: "Family",
    householdSize: 5,
    caseManagerId: "cm-otero",
    acuity: 71,
    status: "urgent",
    note: "Large family card for expanded mounts and higher-density content checks.",
  },
];

const CASE_MANAGER_BY_ID = Object.fromEntries(FAKE_CASE_MANAGERS.map((manager) => [manager.id, manager]));

export const FAKE_CASE_MANAGER_OPTIONS: CaseManagerOption[] = FAKE_CASE_MANAGERS.map((manager) => ({
  uid: manager.id,
  label: manager.name,
  email: `${manager.id}@sandbox.local`,
  active: true,
}));

export const FAKE_CUSTOMER_ENTITIES: TCustomerEntity[] = FAKE_CUSTOMERS.map((customer, index) => {
  const manager = CASE_MANAGER_BY_ID[customer.caseManagerId];
  const createdAt = new Date(Date.UTC(2026, 2, 1 + index * 2)).toISOString();
  const updatedAt = new Date(Date.UTC(2026, 3, 1 + index)).toISOString();
  const isInactive = customer.id === "cust-luna";

  return {
    id: customer.id,
    name: customer.name,
    population: customer.population,
    caseManagerId: customer.caseManagerId,
    caseManagerName: manager?.name || "Unassigned",
    secondaryCaseManagerId: customer.id === "cust-price" ? "cm-harper" : undefined,
    acuityScore: customer.acuity,
    active: !isInactive,
    status: isInactive ? "inactive" : "active",
    createdAt,
    updatedAt,
    hmisId: `HMIS-${index + 101}`,
    cwId: `CW-${index + 201}`,
  } as TCustomerEntity;
});
