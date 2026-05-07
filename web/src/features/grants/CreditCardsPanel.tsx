"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@entities/ui/Modal";
import { useCreditCards, usePatchCreditCards, useUpsertCreditCards } from "@hooks/useCreditCards";
import { useLedgerEntries } from "@hooks/useLedger";
import { usePaymentQueueItems, type PaymentQueueItem } from "@hooks/usePaymentQueue";
import { qk } from "@hooks/queryKeys";
import {
  metricCardClass,
  statusChipClass,
  statusTone,
  toneCardClass,
  toneProgressClass,
} from "@lib/colorRegistry";
import { toast } from "@lib/toast";
import { LINE_ITEMS_FORM_IDS } from "@widgets/jotform/lineItemsFormMap";
import type { CreditCardEntity, TLedgerEntry } from "@types";

type CardHealth = "active" | "warning" | "over";

type LedgerRow = {
  id: string;
  creditCardId: string;
  grantId: string;
  grantLabel: string;
  date: string;
  vendor: string;
  amount: number;
  comment: string;
  note: string[];
  labels: string[];
  submissionToken: string;
};

type PendingSubmission = {
  id: string;
  queueId: string;
  formId: string;
  date: string;
  amount: number;
  vendor: string;
  formKind: "credit-card" | "invoice";
  formTitle: string;
  cardLabel: string;
  creditCardId: string;
  cardBucket: string;
  queueStatus: string;
  grantId: string;
  linkedLedgerId: string;
};

type CreditCardView = {
  id: string;
  name: string;
  code: string;
  last4: string;
  limit: number;
  spent: number;
  remaining: number;
  usedPct: number;
  pending: number;
  health: CardHealth;
  aliases: string[];
  answerValues: string[];
  formIds: { creditCard: string; invoice: string };
  cycleType: string;
  statementCloseDay: number | null;
  notes: string;
  ledgerRows: LedgerRow[];
  pendingRows: PendingSubmission[];
};

type CreateCardDraft = {
  name: string;
  code: string;
  last4: string;
  issuer: string;
  network: string;
  monthlyLimit: string;
  cycleType: "calendar_month" | "statement_cycle";
  statementCloseDay: string;
  aliases: string;
  answerValues: string;
  notes: string;
};

const fmtUsd0 = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const fmtUsd2 = (n: number) =>
  Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const monthLabel = (monthKey: string) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const [year, month] = monthKey.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d);
};

const monthKeyNow = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const DEFAULT_CREATE_CARD_DRAFT = (): CreateCardDraft => ({
  name: "",
  code: "",
  last4: "",
  issuer: "",
  network: "",
  monthlyLimit: "",
  cycleType: "calendar_month",
  statementCloseDay: "",
  aliases: "",
  answerValues: "",
  notes: "",
});

const ensureCreateCardDraft = (value?: Partial<CreateCardDraft> | null): CreateCardDraft => ({
  ...DEFAULT_CREATE_CARD_DRAFT(),
  ...(value || {}),
});

const asText = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("answer" in obj) return asText(obj.answer);
    if ("prettyFormat" in obj) return asText(obj.prettyFormat);
    if ("value" in obj) return asText(obj.value);
    return Object.values(obj).map(asText).filter(Boolean).join(" ");
  }
  return "";
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dateIso10 = (value: unknown): string => {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const monthFromDate = (value: unknown): string => {
  const iso = dateIso10(value);
  return iso ? iso.slice(0, 7) : "";
};

const parseLast4 = (value: unknown) => String(value || "").replace(/\D/g, "").slice(-4);

const parseCommaList = (value: string) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const ledgerAmount = (entry: Record<string, unknown>) => {
  const cents = Number(entry.amountCents);
  if (Number.isFinite(cents)) return cents / 100;
  const amount = Number(entry.amount);
  return Number.isFinite(amount) ? amount : 0;
};

const extractSubmissionToken = (entry: Record<string, unknown>): string => {
  const pieces: string[] = [];
  const comment = String(entry.comment || "");
  if (comment) pieces.push(comment);
  const note = entry.note;
  if (Array.isArray(note)) pieces.push(note.map((x) => String(x || "")).join(" "));
  else if (note != null) pieces.push(String(note));
  if (Array.isArray(entry.labels)) {
    pieces.push((entry.labels as unknown[]).map((x) => String(x || "")).join(" "));
  }
  const joined = pieces.join(" ");
  const match = joined.match(/(?:JOTFORM_SUBMISSION:|jfsub:)([A-Za-z0-9_-]+)/i);
  return match?.[1] || "";
};

function matchingTerms(card: CreditCardEntity) {
  const last4 = parseLast4(card.last4);
  const aliases = Array.isArray(card.matching?.aliases) ? card.matching.aliases : [];
  const answerValues = Array.isArray(card.matching?.cardAnswerValues) ? card.matching.cardAnswerValues : [];
  const raw = [card.name, card.code, ...aliases, ...answerValues, last4];
  const normalized = raw
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => (/^\d{4}$/.test(value) ? value : normalizeText(value)))
    .filter((value) => value.length === 4 || value.length >= 4);
  return Array.from(new Set(normalized));
}

function ledgerEntryMatchesCard(entry: LedgerRow, card: CreditCardEntity) {
  if (entry.creditCardId && entry.creditCardId === card.id) return true;
  const haystack = normalizeText([entry.vendor, entry.comment, entry.grantLabel, ...entry.note, ...entry.labels].join(" "));
  if (!haystack) return false;
  return matchingTerms(card).some((term) => haystack.includes(term));
}

function pendingSubmissionMatchesCard(submission: PendingSubmission, card: CreditCardEntity) {
  if (submission.creditCardId && submission.creditCardId === card.id) return true;
  const cardLabel = normalizeText(submission.cardLabel);
  if (!cardLabel) return false;
  return matchingTerms(card).some((term) => cardLabel.includes(term));
}

function healthFor(usedPct: number): CardHealth {
  if (usedPct >= 100) return "over";
  if (usedPct >= 85) return "warning";
  return "active";
}

function CreditCardTile({
  card,
  month,
  onOpen,
}: {
  card: CreditCardView;
  month: string;
  onOpen: () => void;
}) {
  const healthTone = statusTone(card.health);
  const accentClass = toneProgressClass(healthTone);
  const badgeClass = statusChipClass(card.health);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 text-left shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className={`h-2 w-full bg-gradient-to-r ${accentClass}`} />
      <div className="grid gap-5 p-6 lg:grid-cols-[1.25fr_0.9fr]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Credit Card</div>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">{card.name}</h3>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {card.code || "Spend tracker"}
                {card.last4 ? ` - **** ${card.last4}` : ""}
              </div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}>
              {card.health}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Remaining</div>
              <div className="mt-2 text-4xl font-black tracking-tight text-slate-950 dark:text-slate-50">{fmtUsd0(card.remaining)}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{monthLabel(month)} available</div>
            </div>
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white dark:bg-slate-50 dark:text-slate-950">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 dark:text-slate-500">Monthly Limit</div>
              <div className="mt-1 text-xl font-bold">{fmtUsd0(card.limit)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>Usage</span>
              <span>{Math.round(card.usedPct)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-3 rounded-full bg-gradient-to-r ${accentClass}`}
                style={{ width: `${Math.min(card.usedPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50">
            <div className="text-xs uppercase tracking-wide text-slate-400">Spent</div>
            <div className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">{fmtUsd2(card.spent)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50">
            <div className="text-xs uppercase tracking-wide text-slate-400">Pending</div>
            <div className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">{fmtUsd2(card.pending)}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.pendingRows.length} forms waiting</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50">
            <div className="text-xs uppercase tracking-wide text-slate-400">Activity</div>
            <div className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">{card.ledgerRows.length}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">posted ledger rows</div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function CreditCardsPanel() {
  const router = useRouter();
  const qc = useQueryClient();
  const patchCreditCards = usePatchCreditCards();
  const upsertCreditCards = useUpsertCreditCards();
  const [selectedCardId, setSelectedCardId] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDraft, setCreateDraft] = React.useState<CreateCardDraft>(() => DEFAULT_CREATE_CARD_DRAFT());
  const [creating, setCreating] = React.useState(false);
  const [budgetDraft, setBudgetDraft] = React.useState("");
  const [budgetSaving, setBudgetSaving] = React.useState(false);
  const currentMonth = React.useMemo(() => monthKeyNow(), []);
  const safeCreateDraft = ensureCreateCardDraft(createDraft);

  const { data: cards = [], isLoading: cardsLoading } = useCreditCards(
    { active: true, limit: 100 },
    { staleTime: 30_000 }
  );
  const { data: ledgerEntries = [], isLoading: ledgerLoading } = useLedgerEntries(
    { month: currentMonth, limit: 500, sortBy: "createdAt", sortOrder: "desc" },
    { staleTime: 30_000 }
  );
  const { data: paymentQueueItems = [], isLoading: queueLoading } = usePaymentQueueItems(
    { month: currentMonth, limit: 500 },
    { staleTime: 30_000 }
  );

  const cardLedgerRows = React.useMemo(() => {
    return (ledgerEntries as TLedgerEntry[])
      .filter((entry) => {
        const source = String(entry.source || "").toLowerCase();
        const labels = Array.isArray((entry as Record<string, unknown>).labels)
          ? ((entry as Record<string, unknown>).labels as unknown[]).map((value) => String(value || "").toLowerCase())
          : [];
        return source === "card" || !!entry.creditCardId || labels.includes("credit-card");
      })
      .map((entry) => ({
        id: String(entry.id || ""),
        creditCardId: String(entry.creditCardId || ""),
        grantId: String(entry.grantId || ""),
        grantLabel: String(entry.grantNameAtSpend || entry.grantId || "Unallocated"),
        date: dateIso10(entry.dueDate || entry.date || entry.createdAt || entry.updatedAt),
        vendor: String(entry.vendor || entry.paymentLabelAtSpend || entry.comment || ""),
        amount: ledgerAmount(entry as unknown as Record<string, unknown>),
        comment: String(entry.comment || ""),
        note: Array.isArray(entry.note) ? entry.note.map((x) => String(x || "")) : [],
        labels: Array.isArray(entry.labels) ? entry.labels.map((x) => String(x || "")) : [],
        submissionToken: extractSubmissionToken(entry as unknown as Record<string, unknown>),
      }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [ledgerEntries]);

  const linkedLedgerBySubmissionId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of cardLedgerRows) {
      if (row.submissionToken) map.set(row.submissionToken, row.id);
    }
    return map;
  }, [cardLedgerRows]);

  const pendingRows = React.useMemo(() => {
    return (paymentQueueItems as PaymentQueueItem[])
      .map((item) => {
        const source = String(item.source || "").toLowerCase();
        const formKind = source === "credit-card" ? "credit-card" : source === "invoice" ? "invoice" : null;
        if (!formKind) return null;
        const queueStatus = String(item.queueStatus || "pending").toLowerCase();
        if (queueStatus === "void" || queueStatus === "posted") return null;
        const id = String(item.submissionId || item.paymentId || item.id || "").trim();
        if (!id) return null;
        const date = dateIso10(item.dueDate || item.createdAt || item.postedAt);
        if (monthFromDate(date) !== currentMonth) return null;
        const linkedLedgerId = String(item.ledgerEntryId || "") || linkedLedgerBySubmissionId.get(id) || "";
        if (linkedLedgerId) return null;
        return {
          id,
          queueId: String(item.id || ""),
          formId: String(item.formId || ""),
          date,
          amount: Number(item.amount || 0),
          vendor: String(item.merchant || item.descriptor || item.formTitle || item.formAlias || id),
          formKind,
          formTitle: String(item.formTitle || item.formAlias || "Payment queue item"),
          cardLabel: String(item.card || item.cardBucket || ""),
          creditCardId: String(item.creditCardId || ""),
          cardBucket: String(item.cardBucket || ""),
          queueStatus,
          grantId: String(item.grantId || ""),
          linkedLedgerId,
        } as PendingSubmission;
      })
      .filter(Boolean) as PendingSubmission[];
  }, [currentMonth, linkedLedgerBySubmissionId, paymentQueueItems]);

  const cardViews = React.useMemo(() => {
    return (cards as CreditCardEntity[])
      .filter((card) => card.status !== "deleted")
      .map((card) => {
        const ledgerRowsForCard = cardLedgerRows.filter((entry) => ledgerEntryMatchesCard(entry, card));
        const spent = ledgerRowsForCard.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const pendingRowsForCard = pendingRows.filter((row) => pendingSubmissionMatchesCard(row, card));
        const pending = pendingRowsForCard.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const limit = Number(card.monthlyLimitCents || 0) / 100;
        const remaining = limit - spent;
        const usedPct = limit > 0 ? Math.min(999, Math.max(0, (spent / limit) * 100)) : 0;

        return {
          id: String(card.id || ""),
          name: String(card.name || card.id || "Credit Card"),
          code: String(card.code || ""),
          last4: parseLast4(card.last4),
          limit,
          spent,
          remaining,
          usedPct,
          pending,
          health: healthFor(usedPct),
          aliases: Array.isArray(card.matching?.aliases) ? card.matching.aliases.map((value) => String(value || "")).filter(Boolean) : [],
          answerValues: Array.isArray(card.matching?.cardAnswerValues) ? card.matching.cardAnswerValues.map((value) => String(value || "")).filter(Boolean) : [],
          formIds: {
            creditCard: String(card.matching?.formIds?.creditCard || LINE_ITEMS_FORM_IDS.creditCard),
            invoice: String(card.matching?.formIds?.invoice || LINE_ITEMS_FORM_IDS.invoice),
          },
          cycleType: String(card.cycleType || "calendar_month"),
          statementCloseDay: Number.isFinite(Number(card.statementCloseDay)) ? Number(card.statementCloseDay) : null,
          notes: String(card.notes || ""),
          ledgerRows: ledgerRowsForCard.slice(0, 20),
          pendingRows: pendingRowsForCard.slice(0, 20),
        } as CreditCardView;
      })
      .sort((a, b) => b.usedPct - a.usedPct || b.spent - a.spent || a.name.localeCompare(b.name));
  }, [cardLedgerRows, cards, pendingRows]);

  const selectedCard = React.useMemo(
    () => cardViews.find((card) => card.id === selectedCardId) || null,
    [cardViews, selectedCardId]
  );

  React.useEffect(() => {
    if (!selectedCard) {
      setBudgetDraft("");
      return;
    }
    setBudgetDraft(String(selectedCard.limit.toFixed(2)));
  }, [selectedCard]);

  const totals = React.useMemo(
    () =>
      cardViews.reduce(
        (acc, card) => {
          acc.limit += card.limit;
          acc.spent += card.spent;
          acc.pending += card.pending;
          acc.pendingCount += card.pendingRows.length;
          return acc;
        },
        { limit: 0, spent: 0, pending: 0, pendingCount: 0 }
      ),
    [cardViews]
  );

  const openDigestTool = (_formId: string) => {
    router.push(`/tools/jotforms`);
  };

  const openCreateModal = () => {
    setCreateDraft(DEFAULT_CREATE_CARD_DRAFT());
    setCreateOpen(true);
  };

  const closeCreateModal = (opts?: { force?: boolean }) => {
    if (creating && !opts?.force) return;
    setCreateOpen(false);
    setCreateDraft(DEFAULT_CREATE_CARD_DRAFT());
  };

  const updateCreateDraft = <K extends keyof CreateCardDraft>(key: K, value: CreateCardDraft[K]) => {
    setCreateDraft((prev) => ({
      ...ensureCreateCardDraft(prev),
      [key]: value,
    }));
  };

  const createCard = async () => {
    const draft = ensureCreateCardDraft(createDraft);
    const name = String(draft.name || "").trim();
    if (!name) {
      toast("Card name is required.", { type: "error" });
      return;
    }

    const monthlyLimit = Number(draft.monthlyLimit || 0);
    if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0) {
      toast("Monthly limit must be zero or greater.", { type: "error" });
      return;
    }

    const last4 = parseLast4(draft.last4);
    if (draft.last4.trim() && last4.length !== 4) {
      toast("Last 4 must be exactly four digits.", { type: "error" });
      return;
    }

    const statementCloseDay =
      draft.cycleType === "statement_cycle"
        ? Number(draft.statementCloseDay)
        : null;
    if (
      draft.cycleType === "statement_cycle" &&
      (!Number.isInteger(statementCloseDay) || statementCloseDay < 1 || statementCloseDay > 31)
    ) {
      toast("Statement close day must be between 1 and 31.", { type: "error" });
      return;
    }

    setCreating(true);
    try {
      const resp = await upsertCreditCards.mutateAsync({
        kind: "credit_card",
        name,
        code: String(draft.code || "").trim() || null,
        status: "active",
        issuer: String(draft.issuer || "").trim() || null,
        network: String(draft.network || "").trim() || null,
        last4: last4 || null,
        cycleType: draft.cycleType,
        statementCloseDay: draft.cycleType === "statement_cycle" ? statementCloseDay : null,
        monthlyLimitCents: Math.round(monthlyLimit * 100),
        matching: {
          aliases: parseCommaList(draft.aliases),
          cardAnswerValues: parseCommaList(draft.answerValues),
          formIds: {
            creditCard: LINE_ITEMS_FORM_IDS.creditCard,
            invoice: LINE_ITEMS_FORM_IDS.invoice,
          },
        },
        notes: String(draft.notes || "").trim() || null,
      });
      const createdId =
        resp && typeof resp === "object" && Array.isArray((resp as { ids?: unknown[] }).ids)
          ? String(((resp as { ids?: unknown[] }).ids || [])[0] || "")
          : "";
      await qc.invalidateQueries({ queryKey: qk.creditCards.root });
      toast("Credit card added.", { type: "success" });
      closeCreateModal({ force: true });
      if (createdId) setSelectedCardId(createdId);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Failed to add credit card.";
      toast(message, { type: "error" });
    } finally {
      setCreating(false);
    }
  };

  const saveBudget = async () => {
    if (!selectedCard) return;
    const nextAmount = Number(budgetDraft);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) return;

    setBudgetSaving(true);
    try {
      await patchCreditCards.mutateAsync({
        id: selectedCard.id,
        patch: { monthlyLimitCents: Math.round(nextAmount * 100) },
      });
      await qc.invalidateQueries({ queryKey: qk.creditCards.root });
    } finally {
      setBudgetSaving(false);
    }
  };

  const loading = cardsLoading || ledgerLoading || queueLoading;

  return (
    <>
      <section className="space-y-4" data-tour="grants-credit-cards">
        <div className="flex flex-wrap items-center justify-between gap-3" data-tour="grants-credit-cards-header">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-slate-50">Credit Cards</h2>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {monthLabel(currentMonth)} spend pulled from ledger and payment queue staging, with open card and invoice items surfaced for follow-up.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-xs" onClick={openCreateModal}>
              Add Credit Card
            </button>
            <button type="button" className="btn-secondary btn-xs" onClick={() => openDigestTool(LINE_ITEMS_FORM_IDS.creditCard)}>
              Card Form Map
            </button>
            <button type="button" className="btn-secondary btn-xs" onClick={() => openDigestTool(LINE_ITEMS_FORM_IDS.invoice)}>
              Invoice Form Map
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className={["rounded-2xl border px-4 py-3 shadow-sm", metricCardClass("tracked-cards")].join(" ")}>
            <div className="text-xs uppercase tracking-wide text-slate-400">Tracked Cards</div>
            <div className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">{cardViews.length}</div>
          </div>
          <div className={["rounded-2xl border px-4 py-3 shadow-sm", metricCardClass("card-spent")].join(" ")}>
            <div className="text-xs uppercase tracking-wide text-slate-400">{monthLabel(currentMonth)} Spent</div>
            <div className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">{fmtUsd0(totals.spent)}</div>
          </div>
          <div className={["rounded-2xl border px-4 py-3 shadow-sm", metricCardClass("card-remaining")].join(" ")}>
            <div className="text-xs uppercase tracking-wide text-slate-400">Remaining Limit</div>
            <div className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">{fmtUsd0(totals.limit - totals.spent)}</div>
          </div>
          <div className={["rounded-2xl border px-4 py-3 shadow-sm", metricCardClass("pending-jotform")].join(" ")}>
            <div className="text-xs uppercase tracking-wide text-slate-400">Pending Queue</div>
            <div className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">{fmtUsd0(totals.pending)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{totals.pendingCount} queue items not in ledger yet</div>
          </div>
        </div>

        {cardViews.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {loading
              ? "Loading credit card trackers..."
              : "No active credit card tracker docs are configured yet. Once cards like Housing Card or Youth Card exist, this section will track their monthly usage here."}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2" data-tour="grants-credit-cards-grid">
            {cardViews.map((card) => (
              <CreditCardTile key={card.id} card={card} month={currentMonth} onOpen={() => setSelectedCardId(card.id)} />
            ))}
          </div>
        )}
      </section>

      <Modal
        tourId="grants-credit-card-create-modal"
        isOpen={createOpen}
        onClose={closeCreateModal}
        title="Add Credit Card"
        widthClass="max-w-3xl"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <button className="btn btn-secondary btn-sm" onClick={closeCreateModal} disabled={creating}>
              Cancel
            </button>
            <button className="btn btn-sm" onClick={() => void createCard()} disabled={creating}>
              {creating ? "Creating..." : "Create Card"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Card Name</div>
            <input
              className="input w-full"
              value={safeCreateDraft.name}
              onChange={(e) => updateCreateDraft("name", e.currentTarget.value)}
              placeholder="Housing Card"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Code</div>
            <input
              className="input w-full"
              value={safeCreateDraft.code}
              onChange={(e) => updateCreateDraft("code", e.currentTarget.value)}
              placeholder="HCARD"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Monthly Limit</div>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input w-full"
              value={safeCreateDraft.monthlyLimit}
              onChange={(e) => updateCreateDraft("monthlyLimit", e.currentTarget.value)}
              placeholder="0.00"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Last 4</div>
            <input
              inputMode="numeric"
              maxLength={4}
              className="input w-full"
              value={safeCreateDraft.last4}
              onChange={(e) => updateCreateDraft("last4", e.currentTarget.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Issuer</div>
            <input
              className="input w-full"
              value={safeCreateDraft.issuer}
              onChange={(e) => updateCreateDraft("issuer", e.currentTarget.value)}
              placeholder="Chase"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Network</div>
            <input
              className="input w-full"
              value={safeCreateDraft.network}
              onChange={(e) => updateCreateDraft("network", e.currentTarget.value)}
              placeholder="Visa"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Cycle Type</div>
            <select
              className="select w-full"
              value={safeCreateDraft.cycleType}
              onChange={(e) =>
                updateCreateDraft(
                  "cycleType",
                  e.currentTarget.value === "statement_cycle" ? "statement_cycle" : "calendar_month"
                )
              }
            >
              <option value="calendar_month">Calendar month</option>
              <option value="statement_cycle">Statement cycle</option>
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Statement Close Day</div>
            <input
              type="number"
              min="1"
              max="31"
              step="1"
              className="input w-full"
              value={safeCreateDraft.statementCloseDay}
              onChange={(e) => updateCreateDraft("statementCloseDay", e.currentTarget.value)}
              placeholder={safeCreateDraft.cycleType === "statement_cycle" ? "15" : "Only for statement cycle"}
              disabled={safeCreateDraft.cycleType !== "statement_cycle"}
            />
          </label>
          <label className="text-sm md:col-span-2">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Aliases</div>
            <input
              className="input w-full"
              value={safeCreateDraft.aliases}
              onChange={(e) => updateCreateDraft("aliases", e.currentTarget.value)}
              placeholder="Housing Card, H Card"
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Comma-separated aliases used for ledger and Jotform matching.</div>
          </label>
          <label className="text-sm md:col-span-2">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Card Answer Values</div>
            <input
              className="input w-full"
              value={safeCreateDraft.answerValues}
              onChange={(e) => updateCreateDraft("answerValues", e.currentTarget.value)}
              placeholder="Housing Card, HCARD"
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Comma-separated answer values from the spend forms.</div>
          </label>
          <label className="text-sm md:col-span-2">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Notes</div>
            <textarea
              className="textarea min-h-24 w-full"
              value={safeCreateDraft.notes}
              onChange={(e) => updateCreateDraft("notes", e.currentTarget.value)}
              placeholder="Optional notes about this card."
            />
          </label>
        </div>
      </Modal>

      <Modal
        tourId="grants-credit-card-modal"
        isOpen={!!selectedCard}
        onClose={() => setSelectedCardId("")}
        title={selectedCard ? selectedCard.name : "Credit Card"}
        widthClass="max-w-6xl"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => selectedCard && openDigestTool(selectedCard.formIds.creditCard)}>
                Card Form Map
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => selectedCard && openDigestTool(selectedCard.formIds.invoice)}>
                Invoice Form Map
              </button>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCardId("")}>
                Close
              </button>
              <button
                className="btn btn-sm"
                onClick={() => void saveBudget()}
                disabled={!selectedCard || budgetSaving || !budgetDraft.trim()}
              >
                {budgetSaving ? "Saving..." : "Save Limit"}
              </button>
            </div>
          </div>
        }
      >
        {!selectedCard ? null : (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div className={["rounded-2xl border p-4", metricCardClass("card-spent")].join(" ")}>
                <div className="text-xs uppercase tracking-wide text-slate-400">Spent</div>
                <div className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">{fmtUsd2(selectedCard.spent)}</div>
              </div>
              <div className={["rounded-2xl border p-4", metricCardClass("card-remaining")].join(" ")}>
                <div className="text-xs uppercase tracking-wide text-slate-400">Remaining</div>
                <div className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">{fmtUsd2(selectedCard.remaining)}</div>
              </div>
              <div className={["rounded-2xl border p-4", metricCardClass("pending-jotform")].join(" ")}>
                <div className="text-xs uppercase tracking-wide text-slate-400">Pending</div>
                <div className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">{fmtUsd2(selectedCard.pending)}</div>
              </div>
              <div className={["rounded-2xl border p-4", toneCardClass("slate")].join(" ")}>
                <div className="text-xs uppercase tracking-wide text-slate-400">Cycle</div>
                <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {selectedCard.cycleType === "statement_cycle" && selectedCard.statementCloseDay
                    ? `Statement close day ${selectedCard.statementCloseDay}`
                    : "Calendar month"}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">Tracker Settings</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Monthly Limit</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input w-full"
                      value={budgetDraft}
                      onChange={(e) => setBudgetDraft(e.currentTarget.value)}
                    />
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Form IDs</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                      <div>Card: <span className="font-mono text-xs">{selectedCard.formIds.creditCard || "-"}</span></div>
                      <div>Invoice: <span className="font-mono text-xs">{selectedCard.formIds.invoice || "-"}</span></div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Aliases</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCard.aliases.length ? selectedCard.aliases.map((alias) => (
                        <span key={alias} className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                          {alias}
                        </span>
                      )) : <span className="text-sm text-slate-500 dark:text-slate-400">No aliases configured.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Card Answer Values</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCard.answerValues.length ? selectedCard.answerValues.map((value) => (
                        <span key={value} className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                          {value}
                        </span>
                      )) : <span className="text-sm text-slate-500 dark:text-slate-400">No answer values configured.</span>}
                    </div>
                  </div>
                </div>

                {selectedCard.notes ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    {selectedCard.notes}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">Grant Allocations This Month</div>
                {selectedCard.ledgerRows.length === 0 ? (
                  <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">No posted ledger rows yet for this month.</div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Array.from(
                      selectedCard.ledgerRows.reduce((map, row) => {
                        const key = row.grantLabel || "Unallocated";
                        map.set(key, (map.get(key) || 0) + row.amount);
                        return map;
                      }, new Map<string, number>())
                    )
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, amount]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{label}</div>
                          <div className="text-slate-500 dark:text-slate-400">{fmtUsd2(amount)}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.95fr]">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-slate-50">
                  Posted Ledger Rows
                </div>
                {selectedCard.ledgerRows.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 dark:text-slate-400">No card spend has been posted to ledger for {monthLabel(currentMonth)}.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Vendor</th>
                          <th className="px-4 py-3">Grant</th>
                          <th className="px-4 py-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCard.ledgerRows.map((row) => (
                          <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.date || "-"}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.vendor || row.comment || "-"}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{row.grantLabel || "Unallocated"}</td>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{fmtUsd2(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950 dark:border-slate-700 dark:text-slate-50">
                  Open Payment Queue Items
                </div>
                {selectedCard.pendingRows.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                    No open queue rows matched this card for {monthLabel(currentMonth)}.
                  </div>
                ) : (
                  <div className="space-y-3 p-4">
                    {selectedCard.pendingRows.map((row) => (
                      <div key={row.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{row.vendor || row.formTitle}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {row.formKind === "credit-card" ? "Credit card queue" : "Invoice queue"} - {row.date || "-"}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{fmtUsd2(row.amount)}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {row.cardLabel ? (
                            <span className="rounded-full border border-slate-200 px-2 py-1 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                              Card: {row.cardLabel}
                            </span>
                          ) : null}
                          {row.cardBucket ? (
                            <span className="rounded-full border border-slate-200 px-2 py-1 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                              Bucket: {row.cardBucket}
                            </span>
                          ) : null}
                          {row.grantId ? (
                            <span className="rounded-full border border-slate-200 px-2 py-1 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                              Grant: {row.grantId}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-slate-200 px-2 py-1 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            Status: {row.queueStatus}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button className="btn btn-ghost btn-xs" type="button" onClick={() => router.push("/tools/spending")}>
                            Open Invoicing Tool
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default CreditCardsPanel;
