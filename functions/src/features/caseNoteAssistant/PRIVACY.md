# AI Case Note Assistant data-handling policy

The assistant uses Vertex AI Gemini only as a transient drafting processor. It does not train or fine-tune a model and does not create prompt datasets, response datasets, batch jobs, grounding requests, resumable Live sessions, or application-side prompt/response caches.

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

Request/response logging and project-level Gemini in-memory caching are Google Cloud controls and must also be verified manually; this code does not enable either feature.
