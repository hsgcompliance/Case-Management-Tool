import { z } from "./core.js";
export declare const AssessmentRunStatus: z.ZodEnum<{
    draft: "draft";
    active: "active";
    submitted: "submitted";
    scored: "scored";
    closed: "closed";
    superseded: "superseded";
    voided: "voided";
}>;
export type TAssessmentRunStatus = z.infer<typeof AssessmentRunStatus>;
export declare const AssessmentOpenedReason: z.ZodEnum<{
    manual: "manual";
    intake: "intake";
    reassessment: "reassessment";
    scheduled: "scheduled";
}>;
export declare const AssessmentOutputEntry: z.ZodObject<{
    assessmentName: z.ZodString;
    metric: z.ZodString;
    score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    contextId: z.ZodString;
    submissionId: z.ZodString;
    templateId: z.ZodString;
    templateVersion: z.ZodNumber;
    templateVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    orgId: z.ZodString;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scoredAt: z.ZodString;
    scoredBy: z.ZodString;
}, z.core.$loose>;
export type TAssessmentOutputEntry = z.infer<typeof AssessmentOutputEntry>;
export declare const AssessmentTemplateVersion: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    templateId: z.ZodString;
    orgId: z.ZodString;
    versionNumber: z.ZodNumber;
    status: z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
        deprecated: "deprecated";
    }>>;
    schema: z.ZodUnknown;
    title: z.ZodString;
    kind: z.ZodString;
    publishedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    publishedByUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$loose>;
export type TAssessmentTemplateVersion = z.infer<typeof AssessmentTemplateVersion>;
/** Canonical scope for an assessment template / submission. */
export declare const AssessmentScope: z.ZodEnum<{
    customer: "customer";
    enrollment: "enrollment";
}>;
/**
 * Assessment "kind" is intentionally flexible (string),
 * but these are canonical defaults you can standardize on.
 */
export declare const CanonicalAssessmentKind: z.ZodEnum<{
    custom: "custom";
    acuity: "acuity";
    waitlistPriority: "waitlistPriority";
    progress: "progress";
}>;
/** Who can edit a template (server-enforced). */
export declare const TemplateEditPolicy: z.ZodEnum<{
    adminOnly: "adminOnly";
    ownerOrAdmin: "ownerOrAdmin";
    team: "team";
    org: "org";
}>;
export declare const RubricOption: z.ZodObject<{
    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    label: z.ZodString;
    points: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const RubricQuestion: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    options: z.ZodArray<z.ZodObject<{
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        label: z.ZodString;
        points: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const RubricLevel: z.ZodObject<{
    min: z.ZodDefault<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
    label: z.ZodString;
}, z.core.$strip>;
export declare const RubricDef: z.ZodObject<{
    title: z.ZodString;
    version: z.ZodDefault<z.ZodString>;
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        options: z.ZodArray<z.ZodObject<{
            value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            label: z.ZodString;
            points: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    levels: z.ZodArray<z.ZodObject<{
        min: z.ZodDefault<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
        label: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Template "schema" is a discriminated union so you can add more builders later.
 * For now: rubric-based assessments cover acuity + priority scoring.
 */
export declare const AssessmentSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"rubric">;
    rubric: z.ZodObject<{
        title: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        questions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            options: z.ZodArray<z.ZodObject<{
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                label: z.ZodString;
                points: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        levels: z.ZodArray<z.ZodObject<{
            min: z.ZodDefault<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            label: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>], "type">;
export declare const AssessmentTemplate: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodDefault<z.ZodString>;
    scope: z.ZodDefault<z.ZodEnum<{
        customer: "customer";
        enrollment: "enrollment";
    }>>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    outputLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    version: z.ZodDefault<z.ZodNumber>;
    locked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    templateStatus: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        active: "active";
        deprecated: "deprecated";
    }>>>;
    currentVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    editPolicy: z.ZodDefault<z.ZodEnum<{
        adminOnly: "adminOnly";
        ownerOrAdmin: "ownerOrAdmin";
        team: "team";
        org: "org";
    }>>;
    ownerUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    schema: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"rubric">;
        rubric: z.ZodObject<{
            title: z.ZodString;
            version: z.ZodDefault<z.ZodString>;
            questions: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                options: z.ZodArray<z.ZodObject<{
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                    label: z.ZodString;
                    points: z.ZodDefault<z.ZodNumber>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            levels: z.ZodArray<z.ZodObject<{
                min: z.ZodDefault<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                label: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>], "type">;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$loose>;
/** Type includes dynamic keys. */
export type AssessmentTemplateInput = z.infer<typeof AssessmentTemplate> & Record<string, unknown>;
/** "Doc" variants: what the server returns (id is required). */
export type TAssessmentTemplateDoc = AssessmentTemplateInput & {
    id: string;
};
export declare const AssessmentTemplateUpsertBody: z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodDefault<z.ZodString>;
    scope: z.ZodDefault<z.ZodEnum<{
        customer: "customer";
        enrollment: "enrollment";
    }>>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    outputLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    version: z.ZodDefault<z.ZodNumber>;
    locked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    templateStatus: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        active: "active";
        deprecated: "deprecated";
    }>>>;
    currentVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    editPolicy: z.ZodDefault<z.ZodEnum<{
        adminOnly: "adminOnly";
        ownerOrAdmin: "ownerOrAdmin";
        team: "team";
        org: "org";
    }>>;
    ownerUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    schema: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"rubric">;
        rubric: z.ZodObject<{
            title: z.ZodString;
            version: z.ZodDefault<z.ZodString>;
            questions: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                options: z.ZodArray<z.ZodObject<{
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                    label: z.ZodString;
                    points: z.ZodDefault<z.ZodNumber>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            levels: z.ZodArray<z.ZodObject<{
                min: z.ZodDefault<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                label: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>], "type">;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodDefault<z.ZodString>;
    scope: z.ZodDefault<z.ZodEnum<{
        customer: "customer";
        enrollment: "enrollment";
    }>>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    outputLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    version: z.ZodDefault<z.ZodNumber>;
    locked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    templateStatus: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        active: "active";
        deprecated: "deprecated";
    }>>>;
    currentVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    editPolicy: z.ZodDefault<z.ZodEnum<{
        adminOnly: "adminOnly";
        ownerOrAdmin: "ownerOrAdmin";
        team: "team";
        org: "org";
    }>>;
    ownerUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    schema: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"rubric">;
        rubric: z.ZodObject<{
            title: z.ZodString;
            version: z.ZodDefault<z.ZodString>;
            questions: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                options: z.ZodArray<z.ZodObject<{
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                    label: z.ZodString;
                    points: z.ZodDefault<z.ZodNumber>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            levels: z.ZodArray<z.ZodObject<{
                min: z.ZodDefault<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                label: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>], "type">;
    createdAt: z.ZodOptional<z.ZodUnknown>;
    updatedAt: z.ZodOptional<z.ZodUnknown>;
}, z.core.$loose>>]>;
export type TAssessmentTemplateUpsertReq = z.infer<typeof AssessmentTemplateUpsertBody>;
export type TGetTemplateReq = z.infer<typeof GetTemplateBody>;
export type TListTemplatesReq = z.infer<typeof ListTemplatesBody>;
export type TDeleteTemplateReq = z.infer<typeof DeleteTemplateBody>;
export declare const GetTemplateBody: z.ZodObject<{
    templateId: z.ZodString;
}, z.core.$strip>;
export declare const ListTemplatesBody: z.ZodObject<{
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scope: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        customer: "customer";
        enrollment: "enrollment";
    }>>>;
    includeLocked: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$loose>;
export declare const DeleteTemplateBody: z.ZodObject<{
    templateId: z.ZodString;
    force: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const AssessmentAnswer: z.ZodObject<{
    qId: z.ZodString;
    answer: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strip>;
export declare const AssessmentComputed: z.ZodObject<{
    score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$loose>;
export declare const AssessmentSubmission: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    templateId: z.ZodString;
    templateVersion: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    templateVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodDefault<z.ZodString>;
    scope: z.ZodDefault<z.ZodEnum<{
        customer: "customer";
        enrollment: "enrollment";
    }>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    contextId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        qId: z.ZodString;
        answer: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    }, z.core.$strip>>>;
    computed: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$loose>>>;
    computedBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        server: "server";
        client: "client";
    }>>>;
    byUid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updatedBy: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastPushSurface: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastPushAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        submitted: "submitted";
        scored: "scored";
        closed: "closed";
        superseded: "superseded";
        voided: "voided";
    }>>>;
    openedReason: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        intake: "intake";
        reassessment: "reassessment";
        scheduled: "scheduled";
    }>>>;
    periodKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    supersedes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    supersededByRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    supersededAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
    updatedAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>>;
}, z.core.$loose>;
export type TAssessmentSubmission = z.infer<typeof AssessmentSubmission>;
export type TAssessmentSubmissionDoc = TAssessmentSubmission & {
    id: string;
};
/** Submit (create) a new submission. Supports single submission or array for batch processing. */
export declare const SubmitAssessmentBody: z.ZodUnion<readonly [z.ZodObject<{
    templateId: z.ZodString;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        qId: z.ZodString;
        answer: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    }, z.core.$strip>>>;
    computedClient: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$loose>>>;
}, z.core.$loose>, z.ZodArray<z.ZodObject<{
    templateId: z.ZodString;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        qId: z.ZodString;
        answer: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    }, z.core.$strip>>>;
    computedClient: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$loose>>>;
}, z.core.$loose>>]>;
export declare const GetSubmissionBody: z.ZodObject<{
    submissionId: z.ZodString;
}, z.core.$strip>;
export declare const ListSubmissionsBody: z.ZodObject<{
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    templateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    contextId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        draft: "draft";
        active: "active";
        submitted: "submitted";
        scored: "scored";
        closed: "closed";
        superseded: "superseded";
        voided: "voided";
    }>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$loose>;
/** Admin recompute scores when rules/templates change. */
export declare const RecalcTemplateBody: z.ZodObject<{
    templateId: z.ZodString;
    activeOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type TSubmitAssessmentReq = z.infer<typeof SubmitAssessmentBody>;
export type TGetSubmissionReq = z.infer<typeof GetSubmissionBody>;
export type TListSubmissionsReq = z.infer<typeof ListSubmissionsBody>;
export type TRecalcTemplateReq = z.infer<typeof RecalcTemplateBody>;
/**
 * Push partial answers into an existing open submission without a full re-submit.
 * Merges by qId — later push for same question overwrites prior.
 */
export declare const PushAnswerBody: z.ZodObject<{
    submissionId: z.ZodString;
    answers: z.ZodArray<z.ZodObject<{
        qId: z.ZodString;
        answer: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    }, z.core.$strip>>;
    sourceSurface: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    periodKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type TPushAnswerReq = z.infer<typeof PushAnswerBody>;
/**
 * Open a new submission as a reassessment of a prior one.
 * Provide either priorSubmissionId (direct) or customerId/enrollmentId + kind (lookup).
 * The prior submission is marked superseded atomically.
 */
export declare const OpenReassessmentBody: z.ZodObject<{
    priorSubmissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enrollmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    prefillAnswers: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    openedReason: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        reassessment: "reassessment";
        scheduled: "scheduled";
    }>>>;
}, z.core.$strip>;
export type TOpenReassessmentReq = z.infer<typeof OpenReassessmentBody>;
/**
 * Fetch all versions for a template (newest first).
 */
export declare const ListVersionsBody: z.ZodObject<{
    templateId: z.ZodString;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        draft: "draft";
        published: "published";
        deprecated: "deprecated";
    }>>>;
}, z.core.$strip>;
export type TListVersionsReq = z.infer<typeof ListVersionsBody>;
