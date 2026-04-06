### `functions/src/features/assessments/README.md`

# Assessments (Feature)

Unified assessment engine:

- **Templates** define the rubric/schema and metadata (optionally grant-scoped).
- **Submissions** store answers + server-computed score/level.
- **Snapshots** update customer/enrollment docs for common “latest” use-cases (e.g. acuity, priority).

---

## Contents

| File          | Purpose                                               | Key exports |
| ------------- | ----------------------------------------------------- | ----------- |
| `schemas.ts`  | Zod validation for templates/submissions request bodies | — |
| `services.ts` | Core logic (CRUD templates, submit, list/get, recompute) | — |
| `http.ts`     | Secure HTTP handlers wrapping the services            | `assessmentTemplates*`, `assessmentSubmit`, `assessmentSubmission*`, `assessmentTemplateRecalc` |

---

## Collections

```
assessmentTemplates/
  {templateId}:
    kind: string (e.g. "acuity", "priority")
    scope: "customer" | "enrollment"
    schema: { type: "rubric", rubric: { ... } }
    version: number

assessmentSubmissions/
  {submissionId}:
    templateId: string
    scope: "customer" | "enrollment"
    customerId?: string
    enrollmentId?: string
    answers: [{ qId, answer }]
    computed: { score?, level?, meta? }

customers/
  {customerId}:
    acuity?: { templateId, templateVersion, submissionId, score, level, updatedAt }

customerEnrollments/
  {enrollmentId}:
    priorityAssessment?: { templateId, templateVersion, submissionId, score, level, updatedAt }
    latestAssessment?: { templateId, templateVersion, submissionId, score, level, updatedAt }
```

---

## Endpoints

All endpoints use `secureHandler` (CORS, ID token auth, optional App Check).

| Name                        | Auth  | Method        | Notes |
| --------------------------- | ----- | ------------- | ----- |
| `assessmentTemplatesUpsert` | user  | POST          | Create/update one or many templates |
| `assessmentTemplatesGet`    | user  | GET/POST      | Fetch a template by `templateId` |
| `assessmentTemplatesList`   | user  | GET/POST      | Filter by `grantId`, `kind`, `scope` |
| `assessmentTemplatesDelete` | user  | POST          | Delete a template (respects edit/lock policy) |
| `assessmentSubmit`          | user  | POST          | Submit one or many submissions (server computes score/level) |
| `assessmentSubmissionGet`   | user  | GET/POST      | Fetch a submission by `submissionId` |
| `assessmentSubmissionsList` | user  | GET/POST      | List submissions (customer or enrollment scoped) |
| `assessmentTemplateRecalc`  | admin | POST          | Bulk recompute submissions for a template (safe snapshot pointer checks) |

---

## Example payloads

**Upsert an acuity rubric template**

```json
{
  "id": "acuity_default",
  "kind": "acuity",
  "scope": "customer",
  "title": "Standard Acuity",
  "schema": {
    "type": "rubric",
    "rubric": {
      "title": "Standard Acuity",
      "version": "v1",
      "questions": [
        { "id": "housing", "label": "Housing Stability", "options": [
          { "value": "stable", "label": "Stable", "points": 0 },
          { "value": "risk", "label": "At Risk", "points": 2 }
        ]}
      ],
      "levels": [
        { "min": 0, "max": 3, "label": "Low" },
        { "min": 4, "label": "High" }
      ]
    }
  }
}
```

**Submit answers**

```json
{
  "templateId": "acuity_default",
  "customerId": "abc123",
  "answers": [
    { "qId": "housing", "answer": "risk" }
  ]
}
```

```
POST /acuityRubricsSet
POST /acuitySubmitAnswers
POST /acuityRecalcRubric
```

(Or wire quick curl calls similar to your customers script.)

---

