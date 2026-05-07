"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toApiError } from "@client/api";
import type { Enrollment } from "@client/enrollments";
import type { CustomersUpsertReq, ReqOf, TCustomerEntity } from "@types";
import { AssessmentInput } from "@entities/assessments/AssessmentInput";
import PaymentScheduleBuilderDialog from "@entities/dialogs/payments/PaymentScheduleBuilderDialog";
import CaseManagerSelect from "@entities/selectors/CaseManagerSelect";
import { TaskBuilder, type TaskTemplateDraft } from "@entities/tasks/TaskBuilder";
import { useAssessmentTemplate, useAssessmentTemplates } from "@hooks/useAssessments";
import { useCustomer, useUpsertCustomers, usePatchCustomers } from "@hooks/useCustomers";
import { useCustomerEnrollments, useEnrollCustomer } from "@hooks/useEnrollments";
import {
  useGDriveBuildCustomerFolder,
  useGDriveCustomerFolderIndex,
  ACTIVE_PARENT_ID,
  EXITED_PARENT_ID,
} from "@hooks/useGDrive";
import { useGrants } from "@hooks/useGrants";
import { usePaymentsBuildSchedule, type PaymentScheduleBuildInput } from "@hooks/usePayments";
import { useTasksGenerateScheduleWrite } from "@hooks/useTasks";
import { useMe, useUsers, type CompositeUser } from "@hooks/useUsers";
import { useQueryClient } from "@tanstack/react-query";
import CustomersAPI from "@client/customers";
import { addYears, parseISO10, toISODate } from "@lib/date";
import { DRIVE_FILE_TEMPLATES } from "@lib/driveConfig";
import { findDuplicates, DUP_WARN_THRESHOLD } from "@lib/duplicateScore";
import { formatEnrollmentLabel } from "@lib/enrollmentLabels";
import { isCaseManagerLike } from "@lib/roles";
import { toast } from "@lib/toast";
import { DuplicateChecker, type DupCheckState } from "./DuplicateChecker";
import type { DupMatch } from "@lib/duplicateScore";

type FlowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Population = "Youth" | "Individual" | "Family" | "";
type TemplateDoc = {
  id?: string;
  title?: string;
  scope?: string;
  schema?: unknown;
};
type GrantOption = {
  id: string;
  label: string;
  status?: string | null;
};
type EnrollmentDraft = {
  grantId: string;
  startDate: string;
  endDate: string;
  endDateManuallyEdited: boolean;
};

const FLOW_STEPS: Array<{ step: FlowStep; label: string }> = [
  { step: 1, label: "Basics" },
  { step: 2, label: "Assignment" },
  { step: 3, label: "Programs" },
  { step: 5, label: "Assessments" },
  { step: 6, label: "Tasks" },
  { step: 7, label: "Payments" },
  { step: 8, label: "Files" },
  { step: 9, label: "Build" },
];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultEnrollmentEndDate(startDate?: string | null): string {
  const base = parseISO10(String(startDate || "").trim()) ?? new Date();
  return toISODate(addYears(base, 1));
}

function createEnrollmentDraft(
  grantId: string,
  seed?: Partial<Pick<EnrollmentDraft, "startDate" | "endDate" | "endDateManuallyEdited">>,
): EnrollmentDraft {
  const startDate = String(seed?.startDate || "").trim() || isoToday();
  const endDate =
    String(seed?.endDate || "").trim() ||
    defaultEnrollmentEndDate(startDate);
  return {
    grantId,
    startDate,
    endDate,
    endDateManuallyEdited: Boolean(seed?.endDateManuallyEdited),
  };
}

function parseFolderId(input: string): string | null {
  const text = String(input || "").trim();
  if (!text) return null;
  const byFolderPath = text.match(/\/folders\/([-\w]{20,})/i)?.[1];
  if (byFolderPath) return byFolderPath;
  const byQuery = text.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byQuery) return byQuery;
  if (/^[-\w]{20,}$/.test(text)) return text;
  return null;
}

function displayName(customer: Pick<TCustomerEntity, "firstName" | "lastName" | "name">): string {
  return (
    (customer.name && String(customer.name).trim()) ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    "(Unnamed)"
  );
}

function formatHeaderValue(value: unknown): string {
  return String(value || "").trim();
}

function grantLabel(grant: Record<string, unknown>): string {
  return String(grant.name || grant.code || grant.id || "Program").trim();
}

function readTaskSchedule(enrollment: Enrollment): Array<Record<string, unknown>> {
  const raw = (enrollment as Record<string, unknown>).taskSchedule;
  return Array.isArray(raw)
    ? raw.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

function sortTasks(tasks: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return tasks
    .slice()
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
}

function readPayments(enrollment: Enrollment): Array<Record<string, unknown>> {
  const raw = (enrollment as Record<string, unknown>).payments;
  return Array.isArray(raw)
    ? raw.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

// ── Folder builder config (mirrors GAS config.gs) ────────────────────────────
const FOLDER_TEMPLATES_FLOW = DRIVE_FILE_TEMPLATES;

function renderFlowDocName(tpl: string, first: string, last: string): string {
  return tpl.replace(/\{first\}/gi, first).replace(/\{last\}/gi, last).replace(/\s{2,}/g, " ").trim();
}

function buildFlowFolderName(last: string, first: string, cwid?: string | null) {
  const base = `${last.trim()}, ${first.trim()}`;
  return cwid ? `${base}_${cwid.trim()}` : base;
}

function parseFlowFolderId(input: string): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  const byFolders = s.match(/\/folders\/([-\w]{20,})/i)?.[1];
  if (byFolders) return byFolders;
  const byQuery = s.match(/[?&]id=([-\w]{20,})/i)?.[1];
  if (byQuery) return byQuery;
  if (/^[-\w]{20,}$/.test(s)) return s;
  return null;
}

function StepFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-600">{eyebrow}</div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}

function StepNav({
  step,
  canGoNext,
  nextLabel,
  busy,
  busyLabel,
  onBack,
  onNext,
  onClose,
}: {
  step: FlowStep;
  canGoNext: boolean;
  nextLabel: string;
  busy: boolean;
  busyLabel: string | null;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-sm text-slate-500">{busyLabel || "Progress saves as you move through the flow."}</div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
          Close
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} disabled={busy || step === 1}>
          Back
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onNext} disabled={!canGoNext || busy}>
          {busy ? busyLabel || "Working..." : nextLabel}
        </button>
      </div>
    </div>
  );
}

function EnrollmentAssessmentTemplateCard({
  templateId,
  enrollment,
  customerId,
}: {
  templateId: string;
  enrollment: Enrollment;
  customerId: string;
}) {
  const templateQ = useAssessmentTemplate(templateId, { enabled: !!templateId });
  const template = (templateQ.data as TemplateDoc | null) || null;

  if (templateQ.isLoading) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Loading assessment...</div>;
  }

  return (
    <AssessmentInput
      template={template}
      enrollmentId={enrollment.id}
      enrollmentLabel={formatEnrollmentLabel(enrollment as unknown as Record<string, unknown>)}
      customerId={customerId}
      title={String(template?.title || "Assessment")}
    />
  );
}

function EnrollmentAssessmentSection({
  enrollment,
  customerId,
}: {
  enrollment: Enrollment;
  customerId: string;
}) {
  const templatesQ = useAssessmentTemplates(
    {
      grantId: String(enrollment.grantId || ""),
      scope: "enrollment",
      includeLocked: true,
    },
    { enabled: !!enrollment.id && !!enrollment.grantId, staleTime: 15_000 },
  );
  const templates = Array.isArray(templatesQ.data)
    ? templatesQ.data.filter((item): item is { id?: string } => !!item && typeof item === "object")
    : [];

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-950">
          {formatEnrollmentLabel(enrollment as unknown as Record<string, unknown>)}
        </div>
        <div className="text-xs text-slate-500">
          {templates.length > 0 ? `${templates.length} assessment template(s) available` : "No assessment templates on this program"}
        </div>
      </div>

      {templatesQ.isLoading ? (
        <div className="text-sm text-slate-500">Loading assessment templates...</div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          This enrollment does not currently require an assessment.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const templateId = String(template.id || "").trim();
            if (!templateId) return null;
            return (
              <EnrollmentAssessmentTemplateCard
                key={`${enrollment.id}_${templateId}`}
                templateId={templateId}
                enrollment={enrollment}
                customerId={customerId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NewCustomerFlow({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: users = [] } = useUsers({ status: "all", limit: 500 });
  const { data: grants = [] } = useGrants({ active: true, limit: 500 }, { staleTime: 30_000 });
  const upsertCustomer = useUpsertCustomers();
  const patchCustomer = usePatchCustomers();
  const enrollCustomer = useEnrollCustomer();
  const buildPayments = usePaymentsBuildSchedule();
  const generateTasks = useTasksGenerateScheduleWrite();

  const meUser = (me || null) as CompositeUser | null;
  const meUid = String(meUser?.uid || "");
  const meName = String(meUser?.displayName || meUser?.email || meUid || "").trim() || null;
  const meIsCaseManager = isCaseManagerLike(meUser);

  const caseManagerOptions = React.useMemo(() => {
    const labelFor = (user: CompositeUser) =>
      String(user?.displayName || user?.email || user?.uid || "-").trim();

    return (users || [])
      .filter((user: CompositeUser) => !!user?.uid && isCaseManagerLike(user))
      .map((user: CompositeUser) => ({
        uid: String(user.uid),
        email: user.email ? String(user.email) : null,
        label: labelFor(user),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [users]);

  const grantOptions = React.useMemo<GrantOption[]>(() => {
    return (grants || [])
      .filter((grant): grant is Record<string, unknown> => !!grant && typeof grant === "object")
      .filter((grant) => String(grant.status || "active").toLowerCase() !== "deleted")
      .map((grant) => ({
        id: String(grant.id || "").trim(),
        label: grantLabel(grant),
        status: grant.status ? String(grant.status) : null,
      }))
      .filter((grant) => !!grant.id)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [grants]);

  const caseManagerLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const option of caseManagerOptions) map.set(option.uid, option.label);
    if (meUid && meName) map.set(meUid, meName);
    return map;
  }, [caseManagerOptions, meName, meUid]);

  const [step, setStep] = React.useState<FlowStep>(1);
  const [customerId, setCustomerId] = React.useState<string>("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [cwId, setCwId] = React.useState("");
  const [population, setPopulation] = React.useState<Population>("");
  const [isMyCaseManager, setIsMyCaseManager] = React.useState<boolean>(meIsCaseManager);
  const [primaryCaseManagerId, setPrimaryCaseManagerId] = React.useState<string>(meIsCaseManager ? meUid : "");
  const [secondaryCaseManagerId, setSecondaryCaseManagerId] = React.useState<string>("");
  const [otherContactDrafts, setOtherContactDrafts] = React.useState<Array<{ uid: string; role: string }>>([]);
  const [selectedEnrollmentDrafts, setSelectedEnrollmentDrafts] = React.useState<EnrollmentDraft[]>([]);
  const [wantsTaskReminders, setWantsTaskReminders] = React.useState(false);
  const [taskReminderDrafts, setTaskReminderDrafts] = React.useState<TaskTemplateDraft[]>([]);
  const [wantsPayments, setWantsPayments] = React.useState(false);
  const [paymentBuilderOpen, setPaymentBuilderOpen] = React.useState(false);
  const [wantsFolderLink, setWantsFolderLink] = React.useState(false);
  const [folderUrl, setFolderUrl] = React.useState("");
  const [folderAlias, setFolderAlias] = React.useState("");
  // Folder builder state (step 8)
  const [folderMode, setFolderMode] = React.useState<"none" | "build" | "link">("none");
  const [buildFolderName, setBuildFolderName] = React.useState("");
  const [buildMedicaid, setBuildMedicaid] = React.useState<"yes" | "no" | "not_sure">("not_sure");
  const [buildSelectedTemplates, setBuildSelectedTemplates] = React.useState<Set<string>>(
    () => new Set(FOLDER_TEMPLATES_FLOW.filter((t) => t.defaultChecked).map((t) => t.key)),
  );
  const [buildSubfolderInput, setBuildSubfolderInput] = React.useState("");
  const [buildSubfolders, setBuildSubfolders] = React.useState<string[]>([]);
  const [workingLabel, setWorkingLabel] = React.useState<string | null>(null);
  const [flowError, setFlowError] = React.useState<string | null>(null);

  // Duplicate check
  const qc = useQueryClient();
  const [dupCheckState, setDupCheckState] = React.useState<DupCheckState>("idle");
  const [dupMatches, setDupMatches] = React.useState<DupMatch<TCustomerEntity>[]>([]);
  const [dupOverrideConfirmed, setDupOverrideConfirmed] = React.useState(false);

  React.useEffect(() => {
    if (!meUid) return;
    setIsMyCaseManager((current) => (current ? true : meIsCaseManager));
    setPrimaryCaseManagerId((current) => current || (meIsCaseManager ? meUid : ""));
  }, [meIsCaseManager, meUid]);

  const customerQ = useCustomer(customerId || undefined, { enabled: !!customerId, staleTime: 30_000 });
  const customerRecord = customerQ.data || null;
  const enrollmentsQ = useCustomerEnrollments(customerId || undefined, { enabled: !!customerId });
  const enrollments = React.useMemo(() => enrollmentsQ.data || [], [enrollmentsQ.data]);

  const folderIndexQ = useGDriveCustomerFolderIndex(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
    { enabled: folderMode !== "none" },
  );
  const buildFolder = useGDriveBuildCustomerFolder(
    { activeParentId: ACTIVE_PARENT_ID, exitedParentId: EXITED_PARENT_ID },
  );

  const existingGrantIds = React.useMemo(
    () => new Set(enrollments.map((enrollment) => String(enrollment.grantId || "").trim()).filter(Boolean)),
    [enrollments],
  );
  const programsLocked = existingGrantIds.size > 0;
  const activeEnrollments = React.useMemo(
    () =>
      enrollments.filter((enrollment) => {
        const status = String(enrollment.status || "").toLowerCase();
        if (status === "deleted" || status === "closed") return false;
        if (typeof enrollment.active === "boolean") return enrollment.active;
        return true;
      }),
    [enrollments],
  );
  const selectedGrantIds = React.useMemo(
    () => selectedEnrollmentDrafts.map((draft) => draft.grantId),
    [selectedEnrollmentDrafts],
  );

  React.useEffect(() => {
    if (selectedEnrollmentDrafts.length > 0 || existingGrantIds.size === 0) return;
    const seen = new Set<string>();
    const seeded = enrollments.flatMap((enrollment) => {
      const grantId = String(enrollment.grantId || "").trim();
      if (!grantId || seen.has(grantId)) return [];
      seen.add(grantId);
      return [
        createEnrollmentDraft(grantId, {
          startDate: String(enrollment.startDate || "").slice(0, 10),
          endDate: String(enrollment.endDate || "").slice(0, 10),
          endDateManuallyEdited: Boolean(enrollment.endDate),
        }),
      ];
    });
    if (seeded.length) {
      setSelectedEnrollmentDrafts(seeded);
    }
  }, [enrollments, existingGrantIds.size, selectedEnrollmentDrafts.length]);

  // Reset dup check when identifying fields change after a check was run
  React.useEffect(() => {
    if (dupCheckState !== "idle") {
      setDupCheckState("idle");
      setDupMatches([]);
      setDupOverrideConfirmed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, dob, cwId]);

  // Pre-fill folder name when customer details change
  React.useEffect(() => {
    if (!buildFolderName && lastName.trim() && firstName.trim()) {
      setBuildFolderName(buildFlowFolderName(lastName, firstName, cwId.trim() || null));
    }
  }, [buildFolderName, firstName, lastName, cwId]);

  const builderEnrollments = React.useMemo(
    () =>
      enrollments.map((enrollment) => {
        const status = String(enrollment.status || "").toLowerCase();
        const lineItemIds = Array.from(
          new Set(
            readPayments(enrollment)
              .map((payment) => String(payment.lineItemId || "").trim())
              .filter(Boolean),
          ),
        );
        return {
          id: String(enrollment.id || ""),
          label: formatEnrollmentLabel(enrollment as unknown as Record<string, unknown>),
          grantId: String(enrollment.grantId || ""),
          statusLabel: status === "closed" || status === "deleted" ? ("closed" as const) : ("open" as const),
          lineItemIds,
          scheduleMeta: (enrollment as Record<string, unknown>).scheduleMeta,
        };
      }),
    [enrollments],
  );

  const paymentScheduleCount = React.useMemo(
    () => enrollments.reduce((count, enrollment) => count + readPayments(enrollment).length, 0),
    [enrollments],
  );
  const taskScheduleCount = React.useMemo(
    () => enrollments.reduce((count, enrollment) => count + readTaskSchedule(enrollment).length, 0),
    [enrollments],
  );

  const hasHighDupMatch = dupMatches.some((m) => m.score >= DUP_WARN_THRESHOLD);
  const canStepOneContinue =
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!dob.trim() &&
    dupCheckState === "done" &&
    (!hasHighDupMatch || dupOverrideConfirmed);
  const canStepTwoContinue = !!population && (isMyCaseManager || !!primaryCaseManagerId.trim());
  const canStepThreeContinue = selectedGrantIds.length > 0;
  const folderId = parseFolderId(folderUrl);
  const canFinish =
    !!customerId &&
    activeEnrollments.length > 0 &&
    (folderMode === "none" ||
      folderMode === "build" ||
      (folderMode === "link" && (!folderUrl.trim() || !!parseFlowFolderId(folderUrl)))) &&
    (!wantsFolderLink || !folderUrl.trim() || !!folderId);

  const headerName = React.useMemo(
    () =>
      displayName({
        firstName: formatHeaderValue(customerRecord?.firstName) || firstName.trim(),
        lastName: formatHeaderValue(customerRecord?.lastName) || lastName.trim(),
        name: formatHeaderValue(customerRecord?.name),
      }),
    [customerRecord?.firstName, customerRecord?.lastName, customerRecord?.name, firstName, lastName],
  );
  const headerDob = React.useMemo(
    () => formatHeaderValue(customerRecord?.dob) || dob.trim(),
    [customerRecord?.dob, dob],
  );
  const headerCwId = React.useMemo(
    () => formatHeaderValue(customerRecord?.cwId) || cwId.trim(),
    [customerRecord?.cwId, cwId],
  );
  const headerHmisId = React.useMemo(
    () => formatHeaderValue(customerRecord?.hmisId),
    [customerRecord?.hmisId],
  );
  const headerDetails = React.useMemo(
    () =>
      [
        headerDob ? { label: "DOB", value: headerDob } : null,
        headerCwId ? { label: "CW ID", value: headerCwId } : null,
        headerHmisId ? { label: "HMIS ID", value: headerHmisId } : null,
      ].filter((item): item is { label: string; value: string } => !!item),
    [headerCwId, headerDob, headerHmisId],
  );

  const openCustomerRecord = React.useCallback(
    (id: string) => {
      if (!id) return;
      router.push(`/customers/${id}`);
    },
    [router],
  );

  const ensureCustomerExists = React.useCallback(async (): Promise<string> => {
    const safeFirst = firstName.trim();
    const safeLast = lastName.trim();
    const safeDob = dob.trim();

    if (!safeFirst || !safeLast || !safeDob) {
      throw new Error("First name, last name, and DOB are required.");
    }

    const nextPrimaryId = isMyCaseManager ? meUid : primaryCaseManagerId.trim();
    const nextSecondaryId = secondaryCaseManagerId.trim();
    const nextOtherContacts = otherContactDrafts
      .filter((c) => c.uid.trim())
      .map((c) => ({
        uid: c.uid.trim(),
        name: caseManagerLabelById.get(c.uid.trim()) || null,
        role: c.role.trim() || null,
      }));
    const payloadRow: Record<string, unknown> = {
      ...(customerId ? { id: customerId } : {}),
      firstName: safeFirst,
      lastName: safeLast,
      name: `${safeFirst} ${safeLast}`.trim(),
      dob: safeDob,
      cwId: cwId.trim() || null,
      population: population || null,
      status: "active",
      active: true,
      deleted: false,
      enrolled: true,
      caseManagerId: nextPrimaryId || null,
      caseManagerName: nextPrimaryId ? caseManagerLabelById.get(nextPrimaryId) || null : null,
      secondaryCaseManagerId: nextSecondaryId || null,
      secondaryCaseManagerName: nextSecondaryId ? caseManagerLabelById.get(nextSecondaryId) || null : null,
      ...(nextOtherContacts.length ? { otherContacts: nextOtherContacts } : {}),
    };

    const resp = await upsertCustomer.mutateAsync([payloadRow] as CustomersUpsertReq);
    const nextId =
      customerId ||
      (resp && typeof resp === "object" && Array.isArray((resp as { ids?: unknown[] }).ids)
        ? String(((resp as { ids?: unknown[] }).ids || [])[0] || "").trim()
        : "");

    if (!nextId) {
      throw new Error("Customer was created but no ID was returned.");
    }

    setCustomerId(nextId);
    return nextId;
  }, [
    caseManagerLabelById,
    customerId,
    cwId,
    dob,
    firstName,
    isMyCaseManager,
    lastName,
    meUid,
    otherContactDrafts,
    population,
    primaryCaseManagerId,
    secondaryCaseManagerId,
    upsertCustomer,
  ]);

  const ensureEnrollmentsExist = React.useCallback(
    async (targetCustomerId: string) => {
      const missingDrafts = selectedEnrollmentDrafts.filter(
        (draft) => !existingGrantIds.has(draft.grantId),
      );
      for (const draft of missingDrafts) {
        await enrollCustomer.mutateAsync({
          customerId: targetCustomerId,
          grantId: draft.grantId,
          extra: {
            status: "active",
            active: true,
            startDate: draft.startDate || isoToday(),
            endDate: draft.endDate || defaultEnrollmentEndDate(draft.startDate),
            generateTaskSchedule: true,
          },
        });
      }
      await enrollmentsQ.refetch();
    },
    [enrollCustomer, enrollmentsQ, existingGrantIds, selectedEnrollmentDrafts],
  );

  const runDupCheck = React.useCallback(async () => {
    setDupCheckState("checking");
    setDupMatches([]);
    setDupOverrideConfirmed(false);
    try {
      const all = await qc.fetchQuery({
        queryKey: ["customers", "list", { deleted: "exclude" }, "all-pages", 200, 50_000],
        queryFn: () => CustomersAPI.listAll({ deleted: "exclude" }),
        staleTime: 5 * 60 * 1_000, // 5 min cache for the bulk fetch
      });
      const candidates = Array.isArray(all) ? (all as TCustomerEntity[]) : [];
      const matches = findDuplicates(candidates, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob: dob.trim(),
        cwId: cwId.trim(),
      });
      setDupMatches(matches);
      setDupCheckState("done");
    } catch {
      setDupCheckState("idle");
      toast("Duplicate check failed — please try again.", { type: "error" });
    }
  }, [qc, firstName, lastName, dob, cwId]);

  const goToPrevious = React.useCallback(() => {
    setFlowError(null);
    setStep((current) => {
      const prev = Math.max(1, (current - 1) as FlowStep);
      // Skip removed step 4 (Acuity)
      if (prev === 4) return 3 as FlowStep;
      return prev;
    });
  }, []);

  const goToNext = React.useCallback(async () => {
    setFlowError(null);
    try {
      if (step === 1) {
        if (!canStepOneContinue) return;
        setStep(2);
        return;
      }

      if (step === 2) {
        if (!canStepTwoContinue) return;
        setWorkingLabel("Saving customer...");
        await ensureCustomerExists();
        setStep(3);
        return;
      }

      if (step === 3) {
        if (!canStepThreeContinue) return;
        setWorkingLabel("Creating enrollments...");
        const ensuredCustomerId = await ensureCustomerExists();
        await ensureEnrollmentsExist(ensuredCustomerId);
        setStep(5);
        return;
      }

      if (step === 9) return;
      setStep((current) => Math.min(9, (current + 1) as FlowStep));
    } catch (error: unknown) {
      setFlowError(toApiError(error).error || (error instanceof Error ? error.message : "Unable to continue."));
    } finally {
      setWorkingLabel(null);
    }
  }, [
    canStepOneContinue,
    canStepThreeContinue,
    canStepTwoContinue,
    ensureCustomerExists,
    ensureEnrollmentsExist,
    step,
  ]);

  const buildSchedule = React.useCallback(
    async (payload: PaymentScheduleBuildInput) => {
      setFlowError(null);
      try {
        await buildPayments.mutateAsync(payload);
        setPaymentBuilderOpen(false);
        toast("Payment schedule built.", { type: "success" });
        await enrollmentsQ.refetch();
      } catch (error: unknown) {
        setFlowError(toApiError(error).error || "Failed to build payment schedule.");
      }
    },
    [buildPayments, enrollmentsQ],
  );

  const finishFlow = React.useCallback(async () => {
    if (!canFinish) return;
    setFlowError(null);
    try {
      setWorkingLabel("Finalizing customer setup...");
      const ensuredCustomerId = await ensureCustomerExists();
      await ensureEnrollmentsExist(ensuredCustomerId);

      if (wantsTaskReminders && taskReminderDrafts.length > 0) {
        for (const enrollment of activeEnrollments) {
          const body: ReqOf<"tasksGenerateScheduleWrite"> = {
            enrollmentId: enrollment.id,
            mode: "mergeManaged",
            keepManual: true,
            preserveCompletedManaged: true,
            pinCompletedManaged: true,
            startDate: isoToday(),
            taskDefs: taskReminderDrafts as unknown as ReqOf<"tasksGenerateScheduleWrite">["taskDefs"],
          };
          await generateTasks.mutateAsync(body);
        }
      }

      if (folderMode === "build" && buildFolderName.trim()) {
        setWorkingLabel("Building Drive folder…");
        const templates = FOLDER_TEMPLATES_FLOW.flatMap((tmpl) => {
          if (!buildSelectedTemplates.has(tmpl.key)) return [];
          const docName = renderFlowDocName(tmpl.docNameTpl, firstName.trim(), lastName.trim());
          if ("variants" in tmpl) {
            const fileId = buildMedicaid === "yes" ? tmpl.variants.payer : tmpl.variants.nonpayer;
            return [{ fileId, name: docName }];
          }
          return [{ fileId: tmpl.id, name: docName }];
        });
        const built = await buildFolder.mutateAsync({
          name: buildFolderName.trim(),
          parentId: ACTIVE_PARENT_ID,
          templates,
          subfolders: buildSubfolders,
        });
        const builtFolder = (built as any)?.folder as { id: string; name: string } | undefined;
        if (builtFolder?.id) {
          await patchCustomer.mutateAsync({
            id: ensuredCustomerId,
            patch: {
              meta: {
                driveFolderId: builtFolder.id,
                driveFolders: [{ id: builtFolder.id, name: builtFolder.name, alias: null }],
              },
            },
          } as unknown as Parameters<typeof patchCustomer.mutateAsync>[0]);
        }
      } else if (folderMode === "link" && folderUrl.trim()) {
        const parsedFolderId = parseFlowFolderId(folderUrl);
        if (!parsedFolderId) {
          throw new Error("Enter a valid Google Drive folder URL or ID.");
        }
        await patchCustomer.mutateAsync({
          id: ensuredCustomerId,
          patch: {
            meta: {
              driveFolderId: parsedFolderId,
              driveFolders: [{ id: parsedFolderId, alias: folderAlias.trim() || null, name: folderAlias.trim() || folderUrl.trim() }],
            },
          },
        } as unknown as Parameters<typeof patchCustomer.mutateAsync>[0]);
      } else if (wantsFolderLink && folderUrl.trim()) {
        // Legacy path (kept for safety)
        const parsedFolderId = parseFolderId(folderUrl);
        if (!parsedFolderId) throw new Error("Enter a valid Google Drive folder URL or ID.");
        await patchCustomer.mutateAsync({
          id: ensuredCustomerId,
          patch: {
            meta: {
              driveFolderId: parsedFolderId,
              driveFolders: [{ id: parsedFolderId, alias: folderAlias.trim() || null, name: folderAlias.trim() || folderUrl.trim() }],
            },
          },
        } as unknown as Parameters<typeof patchCustomer.mutateAsync>[0]);
      }

      toast("Customer setup complete.", { type: "success" });
      openCustomerRecord(ensuredCustomerId);
    } catch (error: unknown) {
      setFlowError(toApiError(error).error || (error instanceof Error ? error.message : "Unable to finish setup."));
    } finally {
      setWorkingLabel(null);
    }
  }, [
    activeEnrollments,
    buildFolder,
    buildFolderName,
    buildMedicaid,
    buildSelectedTemplates,
    buildSubfolders,
    canFinish,
    ensureCustomerExists,
    ensureEnrollmentsExist,
    firstName,
    folderAlias,
    folderMode,
    folderUrl,
    generateTasks,
    lastName,
    openCustomerRecord,
    patchCustomer,
    taskReminderDrafts,
    wantsFolderLink,
    wantsTaskReminders,
  ]);

  const canRunDupCheck = !!firstName.trim() && !!lastName.trim() && !!dob.trim();

  const stepContent = step === 1 ? (
    <StepFrame
      eyebrow="Page 1"
      title="Customer basics"
      description="Enter the required fields, then run a duplicate check. Build Client unlocks once the check is complete and any high-similarity matches are reviewed."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="field">
            <span className="label">First name</span>
            <input className="input" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
          </label>
          <label className="field">
            <span className="label">Last name</span>
            <input className="input" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
          </label>
          <label className="field">
            <span className="label">DOB</span>
            <input className="input" type="date" value={dob} onChange={(e) => setDob(e.currentTarget.value)} />
          </label>
          <label className="field">
            <span className="label">Caseworthy ID</span>
            <input className="input" value={cwId} onChange={(e) => setCwId(e.currentTarget.value)} />
          </label>
        </div>

        {/* Duplicate checker — only shown once required fields are filled */}
        {canRunDupCheck ? (
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-950">Duplicate check</div>
            <DuplicateChecker
              checkState={dupCheckState}
              matches={dupMatches}
              onCheck={runDupCheck}
              onOverride={() => setDupOverrideConfirmed(true)}
              overrideConfirmed={dupOverrideConfirmed}
            />
          </div>
        ) : (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
            Enter first name, last name, and DOB to enable the duplicate check.
          </div>
        )}
      </div>
    </StepFrame>
  ) : step === 2 ? (
    <StepFrame
      eyebrow="Page 2"
      title="Population and case manager"
      description="Choose the customer population and decide whether you are the case manager for this record."
    >
      <div className="space-y-6">
        <label className="field max-w-sm">
          <span className="label">Population</span>
          <select className="select" value={population} onChange={(e) => setPopulation(e.currentTarget.value as Population)}>
            <option value="">Select population</option>
            <option value="Youth">Youth</option>
            <option value="Individual">Individual</option>
            <option value="Family">Family</option>
          </select>
        </label>

        <div className="rounded-[22px] border border-slate-200 bg-sky-50 p-4">
          <div className="text-sm font-semibold text-slate-950">Are you the case manager?</div>
          <div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              className={[
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                isMyCaseManager ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
              onClick={() => {
                setIsMyCaseManager(true);
                if (meUid) setPrimaryCaseManagerId(meUid);
              }}
            >
              Yes
            </button>
            <button
              type="button"
              className={[
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                !isMyCaseManager ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
              onClick={() => setIsMyCaseManager(false)}
            >
              No
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {isMyCaseManager ? (
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {meName || "You"} will be saved as the primary case manager.
            </div>
          ) : (
            <label className="field">
              <span className="label">Primary case manager</span>
              <CaseManagerSelect
                value={primaryCaseManagerId || null}
                onChange={(uid) => setPrimaryCaseManagerId(String(uid || ""))}
                options={caseManagerOptions}
                includeAll={false}
                allLabel="Select case manager"
              />
            </label>
          )}

          <label className="field">
            <span className="label">Secondary case manager</span>
            <CaseManagerSelect
              value={secondaryCaseManagerId || null}
              onChange={(uid) => setSecondaryCaseManagerId(String(uid || ""))}
              options={caseManagerOptions}
              includeAll
              allLabel="None"
            />
          </label>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-950">Other contacts</div>
            <div className="text-xs text-slate-500">Add up to 3 additional contacts (compliance, admin, support, etc.)</div>
            {otherContactDrafts.map((contact, index) => (
              <div key={index} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="field">
                    <span className="label">Contact {index + 1}</span>
                    <CaseManagerSelect
                      value={contact.uid || null}
                      onChange={(uid) => {
                        const next = otherContactDrafts.slice();
                        next[index] = { ...next[index], uid: String(uid || "") };
                        setOtherContactDrafts(next);
                      }}
                      options={caseManagerOptions}
                      includeAll
                      allLabel="Select user"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm mb-1"
                  onClick={() => setOtherContactDrafts(otherContactDrafts.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            ))}
            {otherContactDrafts.length < 3 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOtherContactDrafts([...otherContactDrafts, { uid: "", role: "" }])}
              >
                + Add contact
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </StepFrame>
  ) : step === 3 ? (
    <StepFrame
      eyebrow="Page 3"
      title="Program enrollments"
      description="Choose at least one program. Each selection creates an editable enrollment draft with a start date and a default end date one year later."
    >
      <div className="space-y-4">
        {programsLocked ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Programs are locked once enrollments are created so assessments and task previews stay tied to real records.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {grantOptions.map((grant) => {
            const draft = selectedEnrollmentDrafts.find((entry) => entry.grantId === grant.id) || null;
            const selected = !!draft;
            return (
              <div
                key={grant.id}
                className={[
                  "rounded-[22px] border p-4 transition",
                  selected
                    ? "border-sky-500 bg-sky-50"
                    : "border-slate-200 bg-white hover:border-slate-300",
                  programsLocked ? "cursor-not-allowed opacity-70" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  disabled={programsLocked}
                  className="w-full text-left"
                  onClick={() =>
                    setSelectedEnrollmentDrafts((current) =>
                      current.some((entry) => entry.grantId === grant.id)
                        ? current.filter((entry) => entry.grantId !== grant.id)
                        : current.concat(createEnrollmentDraft(grant.id)),
                    )
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">{grant.label}</div>
                    <span className="text-xs text-slate-500">{selected ? "Selected" : "Add"}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {selected
                      ? `Start ${draft?.startDate || isoToday()} | End ${draft?.endDate || defaultEnrollmentEndDate()}`
                      : "Adds a dated enrollment draft"}
                  </div>
                </button>
                {draft ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="field">
                      <span className="label">Start date</span>
                      <input
                        className="input"
                        type="date"
                        value={draft.startDate}
                        disabled={programsLocked}
                        onChange={(e) => {
                          const nextStartDate = e.currentTarget.value;
                          setSelectedEnrollmentDrafts((current) =>
                            current.map((entry) =>
                              entry.grantId !== grant.id
                                ? entry
                                : {
                                    ...entry,
                                    startDate: nextStartDate,
                                    endDate: entry.endDateManuallyEdited
                                      ? entry.endDate
                                      : defaultEnrollmentEndDate(nextStartDate),
                                  },
                            ),
                          );
                        }}
                      />
                    </label>
                    <label className="field">
                      <span className="label">End date</span>
                      <input
                        className="input"
                        type="date"
                        value={draft.endDate}
                        disabled={programsLocked}
                        onChange={(e) => {
                          const nextEndDate = e.currentTarget.value;
                          setSelectedEnrollmentDrafts((current) =>
                            current.map((entry) =>
                              entry.grantId !== grant.id
                                ? entry
                                : {
                                    ...entry,
                                    endDate: nextEndDate,
                                    endDateManuallyEdited: true,
                                  },
                            ),
                          );
                        }}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </StepFrame>
  ) : step === 5 ? (
    <StepFrame
      eyebrow="Page 5A"
      title="Enrollment assessments"
      description="If a selected program carries an assessment, fill it out here against the real enrollment that was just created."
    >
      <div className="space-y-4">
        {!customerId || activeEnrollments.length === 0 ? (
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Enroll the customer in at least one program first.
          </div>
        ) : (
          activeEnrollments.map((enrollment) => (
            <EnrollmentAssessmentSection key={enrollment.id} enrollment={enrollment} customerId={customerId} />
          ))
        )}
      </div>
    </StepFrame>
  ) : step === 6 ? (
    <StepFrame
      eyebrow="Page 6"
      title="Task schedule and reminders"
      description="Program enrollment auto-generated the base task schedule. Review it here, then optionally add reminder-style tasks that will be applied on finish."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {activeEnrollments.map((enrollment) => {
            const tasks = sortTasks(readTaskSchedule(enrollment));
            return (
              <div key={enrollment.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 text-sm font-semibold text-slate-950">
                  {formatEnrollmentLabel(enrollment as unknown as Record<string, unknown>)}
                </div>
                <div className="mb-3 text-xs text-slate-500">{tasks.length} scheduled task(s)</div>
                {tasks.length === 0 ? (
                  <div className="text-sm text-slate-500">No generated tasks on this enrollment.</div>
                ) : (
                  <div className="space-y-2">
                    {tasks.slice(0, 6).map((task, index) => (
                      <div key={`${enrollment.id}_task_${String(task.id || index)}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <div className="font-medium text-slate-900">{String(task.type || task.title || "Task")}</div>
                        <div className="text-xs text-slate-500">
                          {String(task.dueDate || "No due date")} | {String(task.status || "open")}
                        </div>
                      </div>
                    ))}
                    {tasks.length > 6 ? (
                      <div className="text-xs text-slate-500">+{tasks.length - 6} more task(s)</div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-sky-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">
                Would you like to set any task reminders for this customer?
              </div>
              <div className="text-xs text-slate-500">
                These reminder definitions will be added to each active enrollment when you finish the flow.
              </div>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                className={[
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  wantsTaskReminders ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                ].join(" ")}
                onClick={() => setWantsTaskReminders(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={[
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  !wantsTaskReminders ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                ].join(" ")}
                onClick={() => setWantsTaskReminders(false)}
              >
                No
              </button>
            </div>
          </div>

          {wantsTaskReminders ? (
            <div className="mt-4">
              <TaskBuilder editing value={taskReminderDrafts} onChange={setTaskReminderDrafts} />
            </div>
          ) : null}
        </div>
      </div>
    </StepFrame>
  ) : step === 7 ? (
    <StepFrame
      eyebrow="Page 7"
      title="Payment schedules"
      description="Open the payment builder if you want to create payment schedules now. Any schedules you build are saved immediately to the enrollment."
    >
      <div className="space-y-5">
        <div className="rounded-[22px] border border-slate-200 bg-sky-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">
                Would you like to build any payment schedules for this client?
              </div>
              <div className="text-xs text-slate-500">
                Current schedules built: {paymentScheduleCount}
              </div>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                className={[
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  wantsPayments ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                ].join(" ")}
                onClick={() => setWantsPayments(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={[
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  !wantsPayments ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                ].join(" ")}
                onClick={() => setWantsPayments(false)}
              >
                No
              </button>
            </div>
          </div>

          {wantsPayments ? (
            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setPaymentBuilderOpen(true)}
                disabled={builderEnrollments.length === 0 || buildPayments.isPending}
              >
                {buildPayments.isPending ? "Building..." : "Open Payment Builder"}
              </button>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm">
                    <div className="font-semibold text-slate-950">
                      {formatEnrollmentLabel(enrollment as unknown as Record<string, unknown>)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {readPayments(enrollment).length} payment row(s)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </StepFrame>
  ) : step === 8 ? (
    <StepFrame
      eyebrow="Page 8"
      title="Google Drive folder"
      description="Optionally create or link a Drive folder for this customer. You can also do this later from the Files tab."
    >
      <div className="space-y-5">
        {/* Mode selector */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          {(["none", "build", "link"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={[
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                folderMode === mode ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
              onClick={() => setFolderMode(mode)}
            >
              {mode === "none" ? "Skip" : mode === "build" ? "Build New" : "Link Existing"}
            </button>
          ))}
        </div>

        {/* Build new */}
        {folderMode === "build" && (
          <div className="space-y-4 rounded-[22px] border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="field md:col-span-2">
                <span className="label">Folder name</span>
                <input
                  className="input w-full"
                  value={buildFolderName}
                  onChange={(e) => setBuildFolderName(e.currentTarget.value)}
                />
                <span className="mt-1 block text-xs text-slate-400">Convention: Last, First_CWID</span>
              </label>
              <label className="field">
                <span className="label">Medicaid enrolled</span>
                <select
                  className="input w-full"
                  value={buildMedicaid}
                  onChange={(e) => setBuildMedicaid(e.currentTarget.value as typeof buildMedicaid)}
                >
                  <option value="not_sure">Not sure</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>

            {/* Templates */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Copy templates</div>
              <div className="space-y-1.5">
                {FOLDER_TEMPLATES_FLOW.map((tmpl) => {
                  const checked = buildSelectedTemplates.has(tmpl.key);
                  return (
                    <label
                      key={tmpl.key}
                      className={[
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
                        checked ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-sky-600"
                        checked={checked}
                        onChange={() =>
                          setBuildSelectedTemplates((prev) => {
                            const next = new Set(prev);
                            if (next.has(tmpl.key)) next.delete(tmpl.key);
                            else next.add(tmpl.key);
                            return next;
                          })
                        }
                      />
                      <div>
                        <div className="font-medium text-slate-900">{tmpl.label}</div>
                        {"variants" in tmpl && (
                          <div className="text-xs text-slate-400">
                            {buildMedicaid === "yes" ? "Payer variant" : "Non-payer variant"}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Subfolders */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-create subfolders</div>
              {buildSubfolders.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {buildSubfolders.map((sub) => (
                    <span key={sub} className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                      {sub}
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-500 ml-0.5"
                        onClick={() => setBuildSubfolders((prev) => prev.filter((s) => s !== sub))}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="Subfolder name"
                  value={buildSubfolderInput}
                  onChange={(e) => setBuildSubfolderInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const clean = buildSubfolderInput.trim();
                      if (clean && !buildSubfolders.includes(clean)) {
                        setBuildSubfolders((prev) => [...prev, clean]);
                        setBuildSubfolderInput("");
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const clean = buildSubfolderInput.trim();
                    if (clean && !buildSubfolders.includes(clean)) {
                      setBuildSubfolders((prev) => [...prev, clean]);
                      setBuildSubfolderInput("");
                    }
                  }}
                  disabled={!buildSubfolderInput.trim()}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Duplicate check notice */}
            {folderIndexQ.isLoading && (
              <div className="text-xs text-slate-400">Checking index for existing folders…</div>
            )}
          </div>
        )}

        {/* Link existing */}
        {folderMode === "link" && (
          <div className="space-y-4 rounded-[22px] border border-slate-200 bg-white p-4">
            {folderIndexQ.isLoading ? (
              <div className="text-sm text-slate-500">Loading folder index…</div>
            ) : (folderIndexQ.data?.folders?.filter((f) => {
                const fl = f.last?.toLowerCase() ?? "";
                const fl2 = f.first?.toLowerCase() ?? "";
                return fl === lastName.toLowerCase() || fl2 === firstName.toLowerCase();
              }).slice(0, 6) ?? []).length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggestions</div>
                <div className="space-y-1">
                  {(folderIndexQ.data?.folders ?? [])
                    .filter((f) => {
                      const fl = f.last?.toLowerCase() ?? "";
                      return fl === lastName.toLowerCase() || fl.startsWith(lastName.toLowerCase().slice(0, 3));
                    })
                    .slice(0, 6)
                    .map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={[
                          "w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors",
                          folderUrl === f.id ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:bg-slate-50",
                        ].join(" ")}
                        onClick={() => { setFolderUrl(f.id); setFolderAlias(f.name || ""); }}
                      >
                        <div className="font-medium text-slate-900">{f.name}</div>
                        <div className="text-xs text-slate-400">{f.status}{f.cwid ? ` · CWID: ${f.cwid}` : ""}</div>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            <label className="field block">
              <span className="label">Folder URL or Drive ID</span>
              <input
                className="input w-full"
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.currentTarget.value)}
                placeholder="https://drive.google.com/drive/folders/…"
              />
              {folderUrl.trim() && !parseFlowFolderId(folderUrl) ? (
                <span className="mt-1 text-xs text-red-600">Enter a valid Google Drive folder URL or folder ID.</span>
              ) : null}
            </label>
            <label className="field block">
              <span className="label">Alias (optional)</span>
              <input className="input w-full" value={folderAlias} onChange={(e) => setFolderAlias(e.currentTarget.value)} />
            </label>
          </div>
        )}
      </div>
    </StepFrame>
  ) : (
    <StepFrame
      eyebrow="Page 8"
      title="Build and finish"
      description="Most of the setup is already done. Finish will apply any pending task reminders and the optional Google Drive link, then open the customer record."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">Customer</div>
            <div className="mt-2 text-sm text-slate-700">{displayName({ firstName, lastName, name: "" })}</div>
            <div className="mt-1 text-xs text-slate-500">
              DOB {dob || "-"} | CW ID {cwId.trim() || "-"} | Population {population || "-"}
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">Build summary</div>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <div>{activeEnrollments.length} active enrollment(s)</div>
              <div>{taskScheduleCount} generated task(s)</div>
              <div>{paymentScheduleCount} payment row(s)</div>
              <div>{wantsTaskReminders ? `${taskReminderDrafts.length} reminder definition(s) pending finish` : "No extra reminders"}</div>
              <div>
                {folderMode === "build" && buildFolderName.trim()
                  ? `Build folder "${buildFolderName.trim()}" on finish`
                  : folderMode === "link" && folderUrl.trim()
                    ? "Link Drive folder on finish"
                    : "No Drive folder"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-950">Selected programs</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedEnrollmentDrafts.map((draft) => {
              const grant = grantOptions.find((option) => option.id === draft.grantId);
              return (
                <span key={draft.grantId} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {(grant?.label || draft.grantId) +
                    ` | ${draft.startDate || "-"} to ${draft.endDate || "-"}`
                  }
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </StepFrame>
  );

  const nextLabel =
    step === 9
      ? "Finish"
      : step === 8
        ? "Review Build"
        : step === 1 && dupCheckState !== "done"
          ? "Check duplicates first"
          : step === 1 && hasHighDupMatch && !dupOverrideConfirmed
            ? "Review matches above"
            : "Next";
  const canGoNext =
    step === 1
      ? canStepOneContinue
      : step === 2
        ? canStepTwoContinue
        : step === 3
          ? canStepThreeContinue
          : step === 9
            ? canFinish
            : true;

  return (
    <div className="space-y-4">
      {/* Build / busy overlay — covers entire viewport above the modal */}
      {workingLabel ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center backdrop-blur-sm bg-white/30 dark:bg-slate-900/40">
          <div className="rounded-2xl border border-slate-200 bg-white px-10 py-8 shadow-2xl text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800 dark:border-slate-700 dark:border-t-slate-200" />
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{workingLabel}</div>
            <div className="mt-1 text-xs text-slate-500">Please wait…</div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-100 via-white to-cyan-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">New Customer Flow</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Create a customer record</h1>
            <p className="mt-1 text-sm text-slate-600">
              This flow creates the customer first, then reuses the real enrollment, assessment, task, payment, and file tools as each step unlocks.
            </p>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            {customerId || headerName !== "(Unnamed)" ? (
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-900">{headerName}</div>
                {headerDetails.length ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-600">
                    {headerDetails.map((item) => (
                      <span key={item.label}>
                        {item.label} {item.value}
                      </span>
                    ))}
                  </div>
                ) : null}
                {customerId ? (
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Customer ID {customerId}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm font-semibold text-slate-900">Record not created yet</div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {FLOW_STEPS.map((item) => (
            <div
              key={item.step}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em]",
                step === item.step
                  ? "border-slate-900 bg-slate-900 text-white"
                  : step > item.step
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500",
              ].join(" ")}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {flowError ? (
        <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {flowError}
        </div>
      ) : null}

      {stepContent}

      <StepNav
        step={step}
        canGoNext={canGoNext}
        nextLabel={nextLabel}
        busy={
          upsertCustomer.isPending ||
          patchCustomer.isPending ||
          enrollCustomer.isPending ||
          buildPayments.isPending ||
          generateTasks.isPending ||
          buildFolder.isPending
        }
        busyLabel={workingLabel}
        onBack={goToPrevious}
        onNext={() => {
          if (step === 9) {
            void finishFlow();
            return;
          }
          void goToNext();
        }}
        onClose={onClose}
      />

      <PaymentScheduleBuilderDialog
        open={paymentBuilderOpen}
        busy={buildPayments.isPending}
        enrollments={builderEnrollments}
        customerName={[firstName, lastName].filter(Boolean).join(" ").trim() || undefined}
        onCancel={() => setPaymentBuilderOpen(false)}
        onBuild={(payload) => void buildSchedule(payload)}
      />
    </div>
  );
}

export default NewCustomerFlow;
