import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@lib/firebase";
import { MAX_PINNED_BUDGET_GROUPS, parsePinnedBudgetGroupKeys } from "./budgetGroupPinModel";
export { sortPinnedBudgetGroups } from "./budgetGroupPinModel";

export async function getPinnedBudgetGroupKeys(uid: string) {
  if (!uid) return [];
  return parsePinnedBudgetGroupKeys((await getDoc(doc(db, "userExtras", uid))).data());
}

export async function togglePinnedBudgetGroup(uid: string, groupKey: string) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "userExtras", uid);
    const snap = await tx.get(ref);
    const current = parsePinnedBudgetGroupKeys(snap.data());
    const next = current.includes(groupKey) ? current.filter((key) => key !== groupKey) : [groupKey, ...current].slice(0, MAX_PINNED_BUDGET_GROUPS);
    tx.set(ref, { grantPrefs: { pinnedBudgetGroupKeys: next, updatedAt: serverTimestamp() } }, { merge: true });
    return next;
  });
}
