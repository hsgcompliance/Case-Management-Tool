"use client";

import React from "react";
import {
  buildPaymentEditorSavePlan,
  createPaymentEditorBaseline,
  getChangedPaymentEditorRowIds,
  normalizePaymentEditorRow,
  type PaymentEditorBaseline,
  type PaymentEditorRow,
} from "./paymentEditorLabAdapter";
import {
  usePaymentsProjectionsAdjust,
  usePaymentsSpend,
  usePaymentsUpdateCompliance,
  usePaymentRentCert,
} from "@hooks/usePayments";

type SaveResult = {
  savedAt: string;
  changedCount: number;
};

function cloneRows(rows: PaymentEditorRow[]): PaymentEditorRow[] {
  return rows.map((row) => ({ ...row }));
}

function baselineKey(rows: PaymentEditorRow[]): string {
  return rows
    .map((row) => `${row.id}:${normalizePaymentEditorRow(row)}`)
    .sort()
    .join("|");
}

export function usePaymentEditorSheetSave(sourceRows: PaymentEditorRow[], resetKey?: string) {
  const projectionsAdjust = usePaymentsProjectionsAdjust();
  const spend = usePaymentsSpend();
  const updateCompliance = usePaymentsUpdateCompliance();
  const updateRentCert = usePaymentRentCert();

  const [rows, setRows] = React.useState<PaymentEditorRow[]>(() => cloneRows(sourceRows));
  const [baseline, setBaseline] = React.useState<PaymentEditorBaseline>(() =>
    createPaymentEditorBaseline(sourceRows),
  );
  const [secondsUntilSave, setSecondsUntilSave] = React.useState(30);
  const [lastSave, setLastSave] = React.useState<SaveResult | null>(null);
  const [saveError, setSaveError] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);

  const sourceRowsRef = React.useRef(sourceRows);
  const sourceIdentity = React.useMemo(() => baselineKey(sourceRows), [sourceRows]);

  React.useEffect(() => {
    sourceRowsRef.current = sourceRows;
  }, [sourceRows]);

  const changedIds = React.useMemo(
    () => getChangedPaymentEditorRowIds(baseline, rows),
    [baseline, rows],
  );
  const dirty = changedIds.size > 0;
  const plan = React.useMemo(() => buildPaymentEditorSavePlan(baseline, rows), [baseline, rows]);

  const busy = saving || projectionsAdjust.isPending || spend.isPending || updateCompliance.isPending || updateRentCert.isPending;

  const resetToSourceRows = React.useCallback(() => {
    const nextRows = cloneRows(sourceRowsRef.current);
    setRows(nextRows);
    setBaseline(createPaymentEditorBaseline(nextRows));
    setSecondsUntilSave(30);
    setSaveError("");
  }, []);

  React.useEffect(() => {
    resetToSourceRows();
  }, [resetKey, resetToSourceRows]);

  React.useEffect(() => {
    if (dirty) return;
    resetToSourceRows();
  }, [dirty, resetToSourceRows, sourceIdentity]);

  const patchRow = React.useCallback((id: string, patch: Partial<PaymentEditorRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setSaveError("");
  }, []);

  const replaceRow = React.useCallback((id: string, updater: (row: PaymentEditorRow) => PaymentEditorRow) => {
    setRows((current) => current.map((row) => (row.id === id ? updater(row) : row)));
    setSaveError("");
  }, []);

  const addRow = React.useCallback((row: PaymentEditorRow) => {
    setRows((current) => [...current, row]);
    setSaveError("");
  }, []);

  const removeRow = React.useCallback((id: string) => {
    setRows((current) => current.filter((row) => row.id !== id));
    setSaveError("");
  }, []);

  const resetRows = React.useCallback(() => {
    const baselineRows = Array.from(baseline.rows.values()).map((row) => ({ ...row }));
    setRows(baselineRows);
    setSecondsUntilSave(30);
    setSaveError("");
  }, [baseline]);

  const saveNow = React.useCallback(async () => {
    if (savingRef.current) return null;
    const rowsToSave = cloneRows(rows);
    const nextPlan = buildPaymentEditorSavePlan(baseline, rowsToSave);
    if (!nextPlan.changedRowIds.size) return null;
    if (nextPlan.validationErrors.length) {
      const message = nextPlan.validationErrors.join(" ");
      setSaveError(message);
      throw new Error(message);
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await Promise.all(nextPlan.compliancePatches.map((patch) => updateCompliance.mutateAsync({
        enrollmentId: patch.enrollmentId,
        paymentId: patch.paymentId,
        patch: patch.patch,
      })));

      await Promise.all(nextPlan.rentCertPatches.map((patch) => updateRentCert.mutateAsync(patch)));

      for (const post of nextPlan.spendPosts) {
        await spend.mutateAsync({
        body: {
          enrollmentId: post.enrollmentId,
          paymentId: post.paymentId,
          reverse: false,
          forceSync: false,
        },
      });
      }

      for (const adjustment of nextPlan.projectionAdjustments) {
        await projectionsAdjust.mutateAsync(adjustment);
      }

      for (const adjustment of nextPlan.paidAdjustments) {
        await projectionsAdjust.mutateAsync(adjustment);
      }

      for (const deleteInput of nextPlan.paidDeletes) {
        await projectionsAdjust.mutateAsync(deleteInput);
      }

      const nextBaseline = createPaymentEditorBaseline(rowsToSave);
      const result = { savedAt: new Date().toISOString(), changedCount: nextPlan.changedRowIds.size };
      setBaseline(nextBaseline);
      setLastSave(result);
      setSecondsUntilSave(30);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment sheet save failed.";
      setSaveError(message);
      throw error;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [baseline, projectionsAdjust, rows, spend, updateCompliance, updateRentCert]);

  React.useEffect(() => {
    if (!dirty || busy) {
      setSecondsUntilSave(30);
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsUntilSave((current) => {
        if (current <= 1) {
          void saveNow().catch((err: unknown) => {
            setSaveError(err instanceof Error ? err.message : "Autosave failed.");
          });
          return 30;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy, dirty, saveNow]);

  return {
    rows,
    setRows,
    patchRow,
    replaceRow,
    addRow,
    removeRow,
    resetRows,
    baseline,
    changedIds,
    dirty,
    plan,
    busy,
    secondsUntilSave,
    lastSave,
    saveError,
    saveNow,
  };
}
