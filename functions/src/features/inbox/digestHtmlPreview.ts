// functions/src/features/inbox/digestHtmlPreview.ts
// Returns the fully-rendered HTML for any digest type — used by the admin tool preview.
import { z } from "zod";
import { secureHandler, requireLevel } from "../../core";
import { monthKey } from "./utils";
import { buildDigestData } from "./digestCore";
import { buildDigestHtml, buildDigestSubject } from "./digestTemplate";
import { buildBudgetDigestData, buildBudgetDigestHtml } from "./digestBudget";
import { buildEnrollmentDigestData, buildEnrollmentDigestHtml } from "./digestEnrollments";
import { buildCaseManagerDigestData, buildCaseManagerDigestHtml } from "./digestCaseManagers";

const QuerySchema = z.object({
  digestType: z.enum(["caseload", "budget", "enrollments", "caseManagers"]).default("caseload"),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  forUid: z.string().optional(),
});

export const inboxDigestHtmlPreview = secureHandler(
  async (req, res) => {
    const raw = req.method === "GET" ? req.query : req.body;
    const { digestType, month: rawMonth, forUid } = QuerySchema.parse(raw);
    const month = rawMonth || monthKey();

    const caller = (req as any).user;
    const callerUid = caller?.uid as string | undefined;
    if (!callerUid) {
      res.status(401).json({ ok: false, error: "unauthenticated" });
      return;
    }

    // Admins can preview any; non-admins can only preview their own caseload
    if (forUid && forUid !== callerUid) requireLevel(caller, "admin");

    let html = "";
    let subject = "";

    if (digestType === "caseload") {
      const data = await buildDigestData({ month, forUid: forUid || callerUid, cmName: "Preview" });
      html    = buildDigestHtml(data);
      subject = buildDigestSubject(month, data.taskCount);
    } else if (digestType === "budget") {
      requireLevel(caller, "admin");
      const data = await buildBudgetDigestData({ month, recipientName: "Preview" });
      html    = buildBudgetDigestHtml(data);
      subject = `Budget Digest — Preview (${data.grants.length} grants)`;
    } else if (digestType === "enrollments") {
      const uid  = forUid || (caller?.topRole === "admin" || caller?.topRole === "dev" ? undefined : callerUid);
      const data = await buildEnrollmentDigestData({ month, forUid: uid, recipientName: "Preview" });
      html    = buildEnrollmentDigestHtml(data);
      subject = `Enrollment Digest — Preview (${data.active.length} active)`;
    } else {
      requireLevel(caller, "admin");
      const data = await buildCaseManagerDigestData({ month, recipientName: "Preview" });
      html    = buildCaseManagerDigestHtml(data);
      subject = `Case Manager Digest — Preview (${data.rows.length} CMs)`;
    }

    res.status(200).json({ ok: true, html, subject, digestType, month });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);
