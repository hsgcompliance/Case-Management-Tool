// web/src/client/formSessions.ts
// Thin typed wrapper around the `createFormSession` endpoint (authed: user).
// The resolve/complete endpoints are public + token-gated and live in the
// separate forms-web surface, so they are intentionally NOT exposed here.

import api from "./api";
import { idemKey } from "@lib/idem";
import type { TFormWorkflowId } from "@hdb/contracts";

export type CreateFormSessionInput = {
  workflowId: TFormWorkflowId;
  /** Where the session originated. Defaults to the main app. */
  source?: "main_app" | "qr" | "direct_link";
  customerId?: string | null;
  userId?: string | null;
  caseManagerId?: string | null;
  grantId?: string | null;
  paymentQueueId?: string | null;
  ledgerItemId?: string | null;
  creditCardId?: string | null;
  ttlMinutes?: number;
};

export type CreateFormSessionResult = {
  ok: true;
  formSessionId: string;
  renderUrl: string;
  expiresAt: string;
};

const FormSessions = {
  create: (input: CreateFormSessionInput) =>
    api.call("createFormSession", {
      body: { source: "main_app", ...input },
      idempotencyKey: idemKey({ scope: "formSession", op: "create", input }),
    }) as Promise<CreateFormSessionResult>,
};

export default FormSessions;
