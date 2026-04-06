import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";
import {
  authAdmin,
  db,
  isoNow,
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REFRESH_TOKEN,
  RUNTIME,
  secureHandler,
} from "../../core";
import { buildDigestData, sendDigestEmail } from "./digestCore";
import { buildDigestHtml, buildDigestSubject } from "./digestTemplate";
import { buildAndSendBudgetDigest } from "./digestBudget";
import { buildAndSendEnrollmentDigest } from "./digestEnrollments";
import { buildAndSendCaseManagerDigest } from "./digestCaseManagers";
import { sendHtmlEmail } from "./emailer";
import { ScheduleDigestBody } from "./schemas";

type DigestType = "caseload" | "budget" | "enrollments" | "caseManagers";

const DigestTypeSchema = z
  .enum(["caseload", "budget", "enrollments", "caseManagers"])
  .optional();

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractBodyHtml(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[1] || html;
}

async function getUserContact(uid: string): Promise<{ email: string | null; displayName?: string }> {
  const user = await authAdmin.getUser(uid);
  return {
    email: user.email ? String(user.email).trim() : null,
    displayName: user.displayName ? String(user.displayName).trim() : undefined,
  };
}

async function sendCombinedCaseloadDigest(args: {
  to: string;
  months: string[];
  subject?: string;
  message?: string;
  uid: string;
  forUid?: string;
  cmName?: string;
}): Promise<void> {
  const { to, months, subject, message, uid, forUid, cmName } = args;
  const key = `digest_combined_${months.join(",")}_${to.toLowerCase()}`;
  const logRef = db.collection("emailLogs").doc(key);
  const prior = await logRef.get();
  if (prior.exists) return;

  let html = `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><div style="max-width:720px;margin:0 auto"><h2 style="margin:0 0 16px;color:#0f172a">${escapeHtml(subject || "Digest")}</h2>`;
  if (String(message || "").trim()) {
    html += `<div style="margin:12px 0;padding:12px 14px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;white-space:pre-wrap">${escapeHtml(String(message).trim())}</div>`;
  }

  for (const month of months) {
    const data = await buildDigestData({
      month,
      forUid: forUid || uid,
      cmName: cmName || "Case Manager",
    });
    html += `<div style="margin-top:18px">
      <div style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 10px">${escapeHtml(buildDigestSubject(month, data.taskCount))}</div>
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff">
        ${extractBodyHtml(buildDigestHtml(data))}
      </div>
    </div>`;
  }
  html += "</div></body></html>";

  const sent = await sendHtmlEmail({
    from: "hsgcompliance@thehrdc.org",
    to,
    subject: subject || "Digest",
    html,
  });
  await logRef.set(
    {
      id: sent.id || null,
      to,
      months,
      subject: subject || "Digest",
      message: String(message || "").trim() || null,
      createdAt: isoNow(),
    },
    { merge: true }
  );
}

async function deliverScheduledDigest(_docId: string, row: Record<string, unknown>) {
  const cmUid = String(row.cmUid || "").trim();
  if (!cmUid) throw new Error("missing_cm_uid");
  const months = Array.isArray(row.months)
    ? row.months.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  if (!months.length) throw new Error("missing_months");

  const digestType = DigestTypeSchema.parse(row.digestType) ?? "caseload";
  const storedEmail = String(row.targetEmail || "").trim() || null;
  const storedName = String(row.recipientName || "").trim() || undefined;
  const userContact = storedEmail
    ? { email: storedEmail, displayName: storedName }
    : await getUserContact(cmUid);
  const to = userContact.email;
  if (!to) throw new Error("missing_target_email");

  const combine = row.combine !== false;
  const subject = String(row.subject || "").trim() || undefined;
  const subjectTemplate = String(row.subjectTemplate || "").trim() || undefined;
  const message = String(row.message || "").trim() || undefined;
  const forUid = String(row.forUid || "").trim() || undefined;
  const recipientName = storedName || userContact.displayName || to;

  if (digestType === "caseload" && combine && months.length > 1) {
    await sendCombinedCaseloadDigest({
      to,
      months,
      subject,
      message,
      uid: cmUid,
      forUid,
      cmName: recipientName,
    });
    return;
  }

  for (const month of months) {
    if (digestType === "caseload") {
      const digestData = await buildDigestData({
        month,
        forUid: forUid || cmUid,
        cmName: recipientName,
      });
      await sendDigestEmail(to, month, "", { subject, subjectTemplate, message }, digestData);
      continue;
    }

    if (digestType === "budget") {
      await buildAndSendBudgetDigest(to, { month, forUid: cmUid, recipientName });
      continue;
    }

    if (digestType === "enrollments") {
      await buildAndSendEnrollmentDigest(to, { month, forUid, recipientName });
      continue;
    }

    await buildAndSendCaseManagerDigest(to, { month, recipientName });
  }
}

export const inboxScheduleDigest = secureHandler(
  async (req, res) => {
    const body = ScheduleDigestBody.parse(req.body || {});
    const digestType = DigestTypeSchema.parse(
      (req.body as Record<string, unknown> | undefined)?.digestType
    ) ?? "caseload";
    const caller = (req as { user?: { uid?: string } }).user;
    const sendAtMs = new Date(body.sendAt).getTime();
    if (!Number.isFinite(sendAtMs)) {
      res.status(400).json({ ok: false, error: "invalid_sendAt" });
      return;
    }

    const ref = db.collection("scheduledDigests").doc();
    await ref.set({
      type: "monthlyDigest",
      digestType,
      status: "pending",
      cmUid: body.cmUid,
      months: body.months,
      combine: body.combine ?? true,
      subject: body.subject ?? null,
      subjectTemplate: body.subjectTemplate ?? null,
      message: body.message ?? null,
      sendAt: body.sendAt,
      createdAt: isoNow(),
      createdByUid: String(caller?.uid || "") || null,
      sentAt: null,
      error: null,
    });

    res.status(200).json({ ok: true, id: ref.id, sendAt: body.sendAt });
  },
  { auth: "admin", methods: ["POST", "OPTIONS"] }
);

export const processScheduledDigests = onSchedule(
  {
    region: RUNTIME.region,
    schedule: "every 15 minutes",
    secrets: [OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN],
  },
  async () => {
    const nowIso = new Date().toISOString();
    const snap = await db.collection("scheduledDigests").where("status", "==", "pending").limit(200).get();
    const due = snap.docs
      .map((doc) => ({ doc, data: doc.data() as Record<string, unknown> }))
      .filter(({ data }) => {
        const sendAt = String(data.sendAt || "").trim();
        return sendAt && sendAt <= nowIso;
      })
      .sort((a, b) => String(a.data.sendAt || "").localeCompare(String(b.data.sendAt || "")));

    for (const { doc, data } of due) {
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (!fresh.exists) return false;
        const current = fresh.data() as Record<string, unknown>;
        if (String(current.status || "") !== "pending") return false;
        tx.set(doc.ref, { status: "processing", processingAt: isoNow(), error: null }, { merge: true });
        return true;
      });
      if (!claimed) continue;

      try {
        await deliverScheduledDigest(doc.id, data);
        await doc.ref.set({ status: "sent", sentAt: isoNow(), error: null }, { merge: true });
      } catch (error: unknown) {
        await doc.ref.set(
          {
            status: "failed",
            error: String((error as { message?: unknown })?.message || error || "digest_send_failed"),
            failedAt: isoNow(),
          },
          { merge: true }
        );
      }
    }
  }
);
