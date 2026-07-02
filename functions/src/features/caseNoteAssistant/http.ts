import { GenerateCaseNoteSuggestionBodySchema, RecordCaseNoteSuggestionDecisionBodySchema } from "@hdb/contracts";
import { db, FieldValue, requireUid, secureHandler } from "../../core";
import { CaseNoteAssistantError, generateSuggestion } from "./service";

const dedicatedServiceAccount =
  process.env.CASE_NOTE_VERTEX_SERVICE_ACCOUNT ||
  "case-note-vertex-runtime@housing-db-v2.iam.gserviceaccount.com";

export const generateCaseNoteSuggestion = secureHandler(async (req, res) => {
  try {
    const body = GenerateCaseNoteSuggestionBodySchema.parse(req.body || {});
    const result = await generateSuggestion(req.user as Record<string, unknown>, body);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CaseNoteAssistantError) { res.status(error.status).json({ ok: false, error: "case_note_assistant_unavailable", message: error.safeMessage }); return; }
    res.status(400).json({ ok: false, error: "invalid_request", message: "Could not generate suggestion. Please check the note and try again." });
  }
}, { auth: "user", methods: ["POST", "OPTIONS"], serviceAccount: dedicatedServiceAccount });

export const recordCaseNoteSuggestionDecision = secureHandler(async (req, res) => {
  const uid = requireUid(req); const body = RecordCaseNoteSuggestionDecisionBodySchema.parse(req.body || {});
  const ref = db.collection("aiCaseNoteAudit").doc(body.requestId); const snap = await ref.get();
  if (!snap.exists || snap.data()?.uid !== uid) { res.status(404).json({ ok: false, error: "suggestion_not_found" }); return; }
  await ref.set({ acceptedByUser: body.accepted, decisionAt: FieldValue.serverTimestamp() }, { merge: true });
  res.status(200).json({ ok: true });
}, { auth: "user", methods: ["POST", "OPTIONS"], serviceAccount: dedicatedServiceAccount });
