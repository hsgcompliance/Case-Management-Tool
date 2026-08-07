# AI Case Note Assistant data-handling policy

The assistant uses the generally available `gemini-3.1-flash-lite` model only as a transient drafting processor through the regional `us-central1` endpoint. The backend rejects other model or region overrides and explicitly uses the model's `MINIMAL` thinking level to limit unnecessary reasoning tokens. It does not train or fine-tune a model and does not create prompt datasets, response datasets, batch jobs, grounding requests, resumable Live sessions, Interactions API records, or application-side prompt/response caches.

Google necessarily processes each request to generate an answer. Do not describe this integration as preventing Google from processing or technically accessing the submission. The enforceable objective is: BAA-covered processing, no model training, least-privilege access, no optional logging or grounding, and verified zero data retention controls.

## Required PHI controls (fail closed)

Both generation endpoints return a 503 without contacting Google unless all three runtime attestations are explicitly true:

- `CASE_NOTE_PHI_BAA_CONFIRMED`: an authorized owner has verified that the active Google Cloud account/project is governed by an executed BAA covering this GA service.
- `CASE_NOTE_PHI_ZERO_RETENTION_CONFIRMED`: Google has approved any abuse-monitoring exception required for zero data retention and the project is confirmed in scope.
- `CASE_NOTE_PHI_REQUEST_RESPONSE_LOGGING_DISABLED`: per-model/per-project request-response logging is confirmed disabled.

These settings attest external controls; setting them does not create those controls. An authorized privacy/security owner must verify the Google Cloud configuration and contractual status before enabling them. Reconfirm them after account, project, model, region, or terms changes.

## Data lifecycle

1. The authenticated mobile client sends a draft to the Firebase backend.
2. The backend checks customer access, organization settings, payer-workbook eligibility, and quota.
3. The backend assembles the prompt in process memory and sends it directly to Vertex AI.
4. The backend reads the generated suggestion in process memory and returns it to the client.
5. The client keeps the suggestion in React component state only.
6. Accepting copies the suggestion into the existing unsaved session form. Only the normal explicit session save action persists the reviewed note.
7. Dismissed, replaced, abandoned, or regenerated suggestions are not persisted.

Do not add localStorage, sessionStorage, IndexedDB, Firestore, BigQuery, analytics, error-reporting payloads, or debug logging for prompts, source notes, workbook text, generated suggestions, or abandoned drafts.

## Permitted metadata

`privacy.ts` is the strict audit-record allowlist. It permits operational identifiers, feature/action/model/template identifiers, token counts, planning cost, latency, status, acceptance state, and timestamps. It deliberately excludes customer/workbook IDs, names, source text, prompt bodies, response bodies, generated drafts, and error objects.

## Vertex features intentionally unused

- Google Search or Maps grounding
- Gemini Live and session resumption
- context/prompt caching
- tuning or fine-tuning
- batch prediction
- prompt/response datasets
- request/response export or BigQuery logging

## Runtime identity

The two case-note functions default to `case-note-vertex-runtime@housing-db-v2.iam.gserviceaccount.com`. It has `roles/aiplatform.user` and `roles/datastore.user`; it has no project-wide admin role. `CASE_NOTE_VERTEX_SERVICE_ACCOUNT` may override the identity for a different deployment project. No other function references this identity.

Request/response logging, abuse-monitoring exceptions, and any Google-managed caching controls must be verified manually. This code does not enable request/response logging, explicit caching, grounding, tuning, or data-store features.
