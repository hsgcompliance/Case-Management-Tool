"use client";

import React from "react";
import CaseManagerSelect from "@entities/selectors/CaseManagerSelect";
import UserSelect from "@entities/selectors/UserSelect";
import {
  useCustomer,
  usePatchCustomers,
  useSetCustomerCaseManager,
  useSetCustomerSecondaryCaseManager,
} from "@hooks/useCustomers";
import { useCustomerEnrollments } from "@hooks/useEnrollments";
import { useCustomerPayments } from "@hooks/usePayments";
import { useUsers } from "@hooks/useUsers";
import { fmtCurrencyUSD, fmtDateOrDash } from "@lib/formatters";
import { safeISODate10, toISODate } from "@lib/date";
import { normalizeOtherContacts, type CustomerOtherContact } from "../contactCaseManagers";

type Props = {
  customerId: string;
};

function upcomingAndOverdueCounts(
  payments: Array<{ payment: { dueDate?: string | null; paid?: boolean | null } }>
) {
  const today = toISODate(new Date());
  let overdue = 0;
  let upcoming = 0;
  for (const row of payments) {
    const due = safeISODate10(row?.payment?.dueDate) || "";
    if (!due || row?.payment?.paid) continue;
    if (due < today) overdue += 1;
    else upcoming += 1;
  }
  return { overdue, upcoming };
}

export default function CustomerCaseManagementPanel({ customerId }: Props) {
  const { data: customer } = useCustomer(customerId, { enabled: !!customerId });
  const { data: enrollments = [], isLoading: loadingEnrollments } = useCustomerEnrollments(customerId);
  const { data: paymentRows = [], isLoading: loadingPayments } = useCustomerPayments(customerId);
  const { data: users = [] } = useUsers({ status: "all", limit: 500 });
  const patchCustomer = usePatchCustomers();
  const setCaseManager = useSetCustomerCaseManager();
  const setSecondaryCaseManager = useSetCustomerSecondaryCaseManager();

  const currentCM = (customer?.caseManagerId ? String(customer.caseManagerId) : null) ?? null;
  const currentSecondaryCM =
    (customer && "secondaryCaseManagerId" in customer && customer.secondaryCaseManagerId
      ? String(customer.secondaryCaseManagerId)
      : null) ?? null;
  const otherContacts = React.useMemo(
    () => normalizeOtherContacts((customer as { otherContacts?: unknown } | null | undefined)?.otherContacts),
    [customer],
  );
  const [draftRoles, setDraftRoles] = React.useState<Record<string, string>>({});
  const userOptions = React.useMemo(
    () =>
      (users || [])
        .map((user) => ({
          uid: String(user.uid || ""),
          label: String(user.displayName || user.email || user.uid || ""),
          email: user.email ? String(user.email) : null,
          active: user.active !== false && user.disabled !== true,
          roles: Array.isArray(user.roles) ? user.roles.map((role) => String(role)) : [],
        }))
        .filter((user) => !!user.uid && user.active !== false),
    [users],
  );
  const userLabelById = React.useMemo(
    () => new Map(userOptions.map((user) => [user.uid, user.label])),
    [userOptions],
  );

  React.useEffect(() => {
    const next: Record<string, string> = {};
    for (const [index, contact] of otherContacts.entries()) {
      next[`${index}:${contact.uid}`] = contact.role || "";
    }
    setDraftRoles(next);
  }, [otherContacts]);

  const summary = React.useMemo(() => {
    const activeEnrollments = enrollments.filter((e) => e.active !== false && e.status !== "deleted").length;
    const paidAmount = paymentRows
      .filter((r) => r.payment?.paid)
      .reduce((sum, r) => sum + Number(r.payment?.amount || 0), 0);
    const { overdue, upcoming } = upcomingAndOverdueCounts(paymentRows as any);
    const latestDue = paymentRows
      .map((r) => safeISODate10(r.payment?.dueDate) || "")
      .filter(Boolean)
      .sort()
      .at(-1);
    return { activeEnrollments, paidAmount, overdue, upcoming, latestDue };
  }, [enrollments, paymentRows]);

  const onSetCaseManager = async (uid: string | null) => {
    await setCaseManager.mutateAsync({
      id: customerId,
      caseManagerId: uid,
      caseManagerName: null,
    });
  };

  const onSetSecondaryCaseManager = async (uid: string | null) => {
    const nextUid = uid && uid === currentCM ? null : uid;
    await setSecondaryCaseManager.mutateAsync({
      id: customerId,
      secondaryCaseManagerId: nextUid,
      secondaryCaseManagerName: null,
    });
  };

  const saveOtherContacts = async (nextContacts: CustomerOtherContact[]) => {
    const normalized = nextContacts
      .filter((entry) => !!entry.uid && entry.uid !== currentCM && entry.uid !== currentSecondaryCM)
      .slice(0, 3);
    await patchCustomer.mutateAsync({
      id: customerId,
      patch: { otherContacts: normalized },
    });
  };

  const updateOtherContactUser = async (index: number, uid: string | null) => {
    const nextUid = String(uid || "").trim();
    const next = otherContacts.slice();
    if (!nextUid) {
      next.splice(index, 1);
      await saveOtherContacts(next);
      return;
    }
    const existingIndex = next.findIndex((entry, entryIndex) => entry.uid === nextUid && entryIndex !== index);
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    const current = next[index] || { uid: "", name: null, role: null };
    next[index] = { ...current, uid: nextUid, name: userLabelById.get(nextUid) || current.name || null };
    await saveOtherContacts(next);
  };

  const updateOtherContactRole = async (index: number, role: string) => {
    const next = otherContacts.slice();
    if (!next[index]) return;
    next[index] = { ...next[index], role: role.trim() || null };
    await saveOtherContacts(next);
  };

  const removeOtherContact = async (index: number) => {
    const next = otherContacts.filter((_, entryIndex) => entryIndex !== index);
    await saveOtherContacts(next);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] grow">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Case Manager</div>
            <div className="mt-2">
              <CaseManagerSelect
                value={currentCM}
                onChange={(uid) => void onSetCaseManager(uid)}
                includeAll
                allLabel="Unassigned"
                disabled={setCaseManager.isPending}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Current: {customer?.caseManagerName || customer?.caseManagerId || "Unassigned"}
            </div>
          </div>
          <div className="min-w-[260px] grow">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Secondary Contact</div>
            <div className="mt-2">
              <CaseManagerSelect
                value={currentSecondaryCM}
                onChange={(uid) => void onSetSecondaryCaseManager(uid)}
                includeAll
                allLabel="None"
                disabled={setSecondaryCaseManager.isPending}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Current: {(customer as any)?.secondaryCaseManagerName || (customer as any)?.secondaryCaseManagerId || "None"}
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {setCaseManager.isPending || setSecondaryCaseManager.isPending || patchCustomer.isPending
              ? "Saving..."
              : "Changes save immediately"}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Other Contacts</div>
              <div className="mt-1 text-xs text-slate-500">
                Caseload-only contacts. Up to 3. They appear on caseload views but do not receive acuity credit.
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {otherContacts.length === 0 ? (
              <div className="text-xs text-slate-500">No additional contacts yet.</div>
            ) : null}
            {otherContacts.map((contact, index) => {
              const blockedIds = new Set<string>(
                [currentCM, currentSecondaryCM, ...otherContacts.map((entry) => entry.uid)]
                  .filter(Boolean)
                  .filter((uid) => uid !== contact.uid) as string[],
              );
              return (
                <div key={`${contact.uid || "contact"}_${index}`} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr),180px,auto]">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">User</div>
                    <div className="mt-2">
                      <UserSelect
                        value={contact.uid}
                        onChange={(uid) => void updateOtherContactUser(index, uid)}
                        includeUnassigned
                        placeholderLabel="Select contact"
                        status="all"
                        limit={500}
                        options={userOptions.filter((user) => !blockedIds.has(user.uid) || user.uid === contact.uid)}
                        disabled={patchCustomer.isPending}
                      />
                    </div>
                  </div>
                  <label className="block">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Role</div>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      value={draftRoles[`${index}:${contact.uid}`] ?? contact.role ?? ""}
                      onChange={(event) =>
                        setDraftRoles((prev) => ({
                          ...prev,
                          [`${index}:${contact.uid}`]: event.currentTarget.value,
                        }))
                      }
                      onBlur={() => void updateOtherContactRole(index, draftRoles[`${index}:${contact.uid}`] ?? contact.role ?? "")}
                      placeholder="Compliance, admin, support..."
                      disabled={patchCustomer.isPending}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void removeOtherContact(index)}
                      disabled={patchCustomer.isPending}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            {otherContacts.length < 3 ? (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 md:grid-cols-[minmax(0,1fr),180px,auto]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Add User</div>
                  <div className="mt-2">
                    <UserSelect
                      value={null}
                      onChange={(uid) => void saveOtherContacts([
                        ...otherContacts,
                        {
                          uid: String(uid || "").trim(),
                          name: userLabelById.get(String(uid || "").trim()) || null,
                          role: null,
                        },
                      ])}
                      includeUnassigned
                      placeholderLabel="Select user"
                      status="all"
                      limit={500}
                      options={userOptions.filter((user) => user.uid !== currentCM && user.uid !== currentSecondaryCM && !otherContacts.some((entry) => entry.uid === user.uid))}
                      disabled={patchCustomer.isPending}
                    />
                  </div>
                </div>
                <div className="flex items-center text-xs text-slate-500 md:pt-6">
                  Save a user first, then add an optional role.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Active Enrollments</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {loadingEnrollments ? "..." : String(summary.activeEnrollments)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Paid Amount</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {loadingPayments ? "..." : fmtCurrencyUSD(summary.paidAmount)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Unpaid Items</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {loadingPayments ? "..." : `${summary.overdue} overdue / ${summary.upcoming} upcoming`}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Latest Due Date</div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {loadingPayments ? "..." : fmtDateOrDash(summary.latestDue)}
          </div>
        </div>
      </div>
    </div>
  );
}
