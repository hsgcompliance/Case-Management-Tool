import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { callFunction } from "@/lib/functionsApi";
import { qk } from "@hooks/queryKeys";
import { RQ_DEFAULTS, RQ_DETAIL } from "@hooks/base";
import type { User } from "firebase/auth";

export interface DriveFolderRef {
  id?: string;
  url?: string;
  name?: string;
  alias?: string;
}

export interface OtherContact {
  uid: string;
  name?: string | null;
  role?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  population?: string;
  dob?: string;
  caseManagerId?: string;
  caseManagerName?: string;
  secondaryCaseManagerId?: string;
  secondaryCaseManagerName?: string;
  otherContacts?: OtherContact[];
  cwId?: string;
  hmisId?: string;
  phone?: string;
  email?: string;
  active?: boolean;
  status?: string;
  createdAt?: string;
  orgId?: string;
  driveFolderId?: string;
  driveFolders?: DriveFolderRef[];
  meta?: {
    notes?: string;
    driveFolderId?: string;
    driveFolders?: DriveFolderRef[];
  };
}

function docToCustomer(id: string, d: Record<string, any>): Customer {
  const name =
    (d.name && String(d.name).trim()) ||
    [d.firstName, d.lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed)";
  return {
    id, name,
    firstName: d.firstName,
    lastName: d.lastName,
    population: d.population,
    dob: d.dob,
    caseManagerId: d.caseManagerId,
    caseManagerName: d.caseManagerName,
    secondaryCaseManagerId: d.secondaryCaseManagerId,
    secondaryCaseManagerName: d.secondaryCaseManagerName,
    otherContacts: Array.isArray(d.otherContacts) ? d.otherContacts : undefined,
    cwId: d.cwId,
    hmisId: d.hmisId,
    phone: d.phone,
    email: d.email,
    active: d.active,
    status: d.status,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? d.createdAt,
    orgId: d.orgId,
    driveFolderId: d.driveFolderId,
    driveFolders: d.driveFolders,
    meta: d.meta,
  };
}

function sortByName(a: Customer, b: Customer) {
  return a.name.localeCompare(b.name);
}

async function fetchMyCustomers(uid: string): Promise<Customer[]> {
  const snap = await getDocs(
    query(collection(db, "customers"), where("caseManagerId", "==", uid)),
  );
  return snap.docs
    .map((d) => docToCustomer(d.id, d.data()))
    .filter((c) => c.active !== false && c.status !== "inactive" && c.status !== "closed")
    .sort(sortByName);
}

/** My assigned caseload — active customers only. */
export function useMyCustomersRich(uid: string | undefined) {
  return useQuery({
    queryKey: qk.customers.mine(uid ?? ""),
    queryFn: () => fetchMyCustomers(uid!),
    enabled: !!uid,
    ...RQ_DEFAULTS,
    staleTime: 10 * 60_000, // shorter: CMs reassign frequently
  });
}

async function fetchOrgCustomers(user: User): Promise<Customer[]> {
  const claims = (await user.getIdTokenResult()).claims;
  const orgId = (claims.orgId ?? claims.org ?? "") as string;
  if (!orgId) return [];
  const snap = await getDocs(
    query(collection(db, "customers"), where("orgId", "==", orgId)),
  );
  return snap.docs.map((d) => docToCustomer(d.id, d.data())).sort(sortByName);
}

/** All customers in the org — used for search / any-customer logging. */
export function useOrgCustomers(user: User | null) {
  return useQuery({
    queryKey: qk.customers.org(user?.uid ?? ""),
    queryFn: () => fetchOrgCustomers(user!),
    enabled: !!user,
    ...RQ_DEFAULTS,
    staleTime: 15 * 60_000,
  });
}

async function fetchCustomerById(id: string): Promise<Customer | null> {
  const snap = await getDoc(doc(db, "customers", id));
  if (!snap.exists()) return null;
  return docToCustomer(snap.id, snap.data());
}

/** Single customer detail. */
export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: qk.customers.detail(id ?? ""),
    queryFn: () => fetchCustomerById(id!),
    enabled: !!id,
    ...RQ_DETAIL,
    staleTime: 10 * 60_000,
  });
}

/** Patch customer fields (CM assignment, etc.) via Cloud Function. Invalidates detail + root. */
export function usePatchCustomer(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Customer, "caseManagerId" | "caseManagerName" | "secondaryCaseManagerId" | "secondaryCaseManagerName">>) => {
      await callFunction("customersPatch", { id: customerId, patch });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.customers.detail(customerId) });
      qc.invalidateQueries({ queryKey: qk.customers.root });
    },
  });
}

/** Mark a customer inactive via Cloud Functions, and close any active enrollment IDs passed in. */
export function useMarkCustomerInactive(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activeEnrollmentIds: string[]) => {
      await callFunction("customersUpsert", [{ id: customerId, active: false }]);
      if (activeEnrollmentIds.length > 0) {
        await Promise.all(
          activeEnrollmentIds.map((eid) =>
            callFunction("enrollmentsUpsert", [{ id: eid, active: false }]),
          ),
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.customers.detail(customerId) });
      qc.invalidateQueries({ queryKey: qk.customers.root });
      qc.invalidateQueries({ queryKey: qk.enrollments.byCustomer(customerId) });
    },
  });
}
