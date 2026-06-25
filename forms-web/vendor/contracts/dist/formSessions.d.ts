import { z } from "./core.js";
import { Ok } from "./http.js";
export declare const FormWorkflowId: z.ZodEnum<{
    "credit-card-checkout": "credit-card-checkout";
    "credit-card-status": "credit-card-status";
    "customer-prefill": "customer-prefill";
    "invoice-request": "invoice-request";
}>;
export type TFormWorkflowId = z.infer<typeof FormWorkflowId>;
export declare const FormRenderMode: z.ZodEnum<{
    custom: "custom";
    auto: "auto";
}>;
export type TFormRenderMode = z.infer<typeof FormRenderMode>;
export declare const FormSessionStatus: z.ZodEnum<{
    submitted: "submitted";
    completed: "completed";
    expired: "expired";
    revoked: "revoked";
    created: "created";
    opened: "opened";
}>;
export type TFormSessionStatus = z.infer<typeof FormSessionStatus>;
export declare const FormSessionSource: z.ZodEnum<{
    main_app: "main_app";
    qr: "qr";
    direct_link: "direct_link";
}>;
export type TFormSessionSource = z.infer<typeof FormSessionSource>;
export declare const FormWorkflowConfig: z.ZodObject<{
    workflowId: z.ZodEnum<{
        "credit-card-checkout": "credit-card-checkout";
        "credit-card-status": "credit-card-status";
        "customer-prefill": "customer-prefill";
        "invoice-request": "invoice-request";
    }>;
    jotformFormId: z.ZodDefault<z.ZodString>;
    mode: z.ZodDefault<z.ZodEnum<{
        custom: "custom";
        auto: "auto";
    }>>;
    auth: z.ZodDefault<z.ZodLiteral<"signed-link">>;
    requiredContext: z.ZodDefault<z.ZodArray<z.ZodString>>;
    linkTo: z.ZodDefault<z.ZodArray<z.ZodString>>;
    prefill: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    afterSubmit: z.ZodDefault<z.ZodObject<{
        linkJotformSubmission: z.ZodDefault<z.ZodBoolean>;
        updatePaymentQueueStatus: z.ZodDefault<z.ZodBoolean>;
        showStatusPage: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TFormWorkflowConfig = z.infer<typeof FormWorkflowConfig>;
/**
 * The known context ids a session can carry. Kept narrow and boring.
 */
export declare const FORM_CONTEXT_KEYS: readonly ["customerId", "userId", "caseManagerId", "grantId", "paymentQueueId", "ledgerItemId", "creditCardId"];
export type TFormContextKey = (typeof FORM_CONTEXT_KEYS)[number];
/**
 * Canonical workflow definitions. jotformFormId is intentionally blank here and
 * resolved from org config / env at runtime (WORKFLOW_FORM_IDS in the backend
 * service) so we never hardcode form ids in the shared contract. Today the
 * checkout workflow renders the "Credit Card Checkout" form (251590902397160).
 */
export declare const WORKFLOW_CONFIGS: Record<TFormWorkflowId, TFormWorkflowConfig>;
export declare const FormPrefillSnapshot: z.ZodObject<{
    customerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    grantName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amountCents: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    paymentMonth: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    checkoutStatus: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cardId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    cardName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currentMonthCardSpendCents: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    monthlyLimitCents: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$loose>;
export type TFormPrefillSnapshot = z.infer<typeof FormPrefillSnapshot>;
export declare const FormSubmissionSnapshot: z.ZodObject<{
    jotformFormId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jotformSubmissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submittedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amountCents: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$loose>;
export type TFormSubmissionSnapshot = z.infer<typeof FormSubmissionSnapshot>;
export declare const FormSessionEntity: z.ZodObject<{
    id: z.ZodString;
    orgId: z.ZodString;
    workflowId: z.ZodEnum<{
        "credit-card-checkout": "credit-card-checkout";
        "credit-card-status": "credit-card-status";
        "customer-prefill": "customer-prefill";
        "invoice-request": "invoice-request";
    }>;
    status: z.ZodEnum<{
        submitted: "submitted";
        completed: "completed";
        expired: "expired";
        revoked: "revoked";
        created: "created";
        opened: "opened";
    }>;
    source: z.ZodEnum<{
        main_app: "main_app";
        qr: "qr";
        direct_link: "direct_link";
    }>;
    customerId: z.ZodNullable<z.ZodString>;
    userId: z.ZodNullable<z.ZodString>;
    caseManagerId: z.ZodNullable<z.ZodString>;
    grantId: z.ZodNullable<z.ZodString>;
    paymentQueueId: z.ZodNullable<z.ZodString>;
    ledgerItemId: z.ZodNullable<z.ZodString>;
    creditCardId: z.ZodNullable<z.ZodString>;
    jotformFormId: z.ZodNullable<z.ZodString>;
    jotformSubmissionId: z.ZodNullable<z.ZodString>;
    tokenHash: z.ZodString;
    expiresAt: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>;
    prefillSnapshot: z.ZodNullable<z.ZodObject<{
        customerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        grantId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        grantName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        caseManagerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amountCents: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        paymentMonth: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        vendor: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        checkoutStatus: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        cardId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
        cardName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        currentMonthCardSpendCents: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        monthlyLimitCents: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.core.$loose>>;
    submissionSnapshot: z.ZodNullable<z.ZodObject<{
        jotformFormId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        jotformSubmissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        submittedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amountCents: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.core.$loose>>;
    createdByUid: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    submittedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodObject<{
        seconds: z.ZodNumber;
        nanoseconds: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$loose>;
export type TFormSessionEntity = z.infer<typeof FormSessionEntity>;
export declare const FormSessionCreateBody: z.ZodObject<{
    workflowId: z.ZodEnum<{
        "credit-card-checkout": "credit-card-checkout";
        "credit-card-status": "credit-card-status";
        "customer-prefill": "customer-prefill";
        "invoice-request": "invoice-request";
    }>;
    source: z.ZodDefault<z.ZodEnum<{
        main_app: "main_app";
        qr: "qr";
        direct_link: "direct_link";
    }>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    userId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    caseManagerId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    paymentQueueId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    ledgerItemId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    creditCardId: z.ZodOptional<z.ZodNullable<z.ZodPreprocess<z.ZodString>>>;
    ttlMinutes: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    orgId: z.ZodOptional<z.ZodPreprocess<z.ZodString>>;
}, z.core.$loose>;
export type TFormSessionCreateBody = z.infer<typeof FormSessionCreateBody>;
export type TFormSessionCreateResp = Ok<{
    formSessionId: string;
    renderUrl: string;
    expiresAt: string;
}>;
export declare const FormSessionResolveBody: z.ZodObject<{
    token: z.ZodString;
}, z.core.$loose>;
export type TFormSessionResolveBody = z.infer<typeof FormSessionResolveBody>;
/** Safe, token-scoped view returned to the Forms surface (no broad data). */
export type TFormSessionResolved = {
    formSessionId: string;
    workflowId: TFormWorkflowId;
    status: TFormSessionStatus;
    renderMode: TFormRenderMode;
    jotformFormId: string | null;
    config: TFormWorkflowConfig;
    prefill: TFormPrefillSnapshot | null;
    context: {
        customerId: string | null;
        grantId: string | null;
        paymentQueueId: string | null;
        creditCardId: string | null;
    };
    jotformSubmissionId: string | null;
    expiresAt: string;
    expired: boolean;
};
export type TFormSessionResolveResp = Ok<{
    session: TFormSessionResolved;
}>;
export declare const FormSessionCompleteBody: z.ZodObject<{
    token: z.ZodString;
    jotformSubmissionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submission: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$loose>;
export type TFormSessionCompleteBody = z.infer<typeof FormSessionCompleteBody>;
export type TFormSessionCompleteResp = Ok<{
    formSessionId: string;
    status: TFormSessionStatus;
    linked: boolean;
}>;
export declare function getWorkflowConfig(workflowId: TFormWorkflowId): TFormWorkflowConfig;
