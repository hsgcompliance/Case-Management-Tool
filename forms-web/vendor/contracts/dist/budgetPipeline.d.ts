import { z } from "zod";
export declare const PipelineOperator: z.ZodEnum<{
    in: "in";
    equals: "equals";
    not_equals: "not_equals";
    contains: "contains";
    not_contains: "not_contains";
    starts_with: "starts_with";
    not_in: "not_in";
    gte: "gte";
    lte: "lte";
    gt: "gt";
    lt: "lt";
    is_true: "is_true";
    is_false: "is_false";
    before: "before";
    after: "after";
    is_empty: "is_empty";
    is_not_empty: "is_not_empty";
}>;
export type TPipelineOperator = z.infer<typeof PipelineOperator>;
export declare const PipelineStatus: z.ZodEnum<{
    draft: "draft";
    active: "active";
    inactive: "inactive";
}>;
export type TPipelineStatus = z.infer<typeof PipelineStatus>;
export declare const PipelineCondition: z.ZodObject<{
    id: z.ZodString;
    field: z.ZodString;
    operator: z.ZodEnum<{
        in: "in";
        equals: "equals";
        not_equals: "not_equals";
        contains: "contains";
        not_contains: "not_contains";
        starts_with: "starts_with";
        not_in: "not_in";
        gte: "gte";
        lte: "lte";
        gt: "gt";
        lt: "lt";
        is_true: "is_true";
        is_false: "is_false";
        before: "before";
        after: "after";
        is_empty: "is_empty";
        is_not_empty: "is_not_empty";
    }>;
    value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
export type TPipelineCondition = z.infer<typeof PipelineCondition>;
export declare const PipelineConditionGroup: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    logic: z.ZodEnum<{
        AND: "AND";
        OR: "OR";
    }>;
    kind: z.ZodEnum<{
        include: "include";
        exclude: "exclude";
    }>;
    conditions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        field: z.ZodString;
        operator: z.ZodEnum<{
            in: "in";
            equals: "equals";
            not_equals: "not_equals";
            contains: "contains";
            not_contains: "not_contains";
            starts_with: "starts_with";
            not_in: "not_in";
            gte: "gte";
            lte: "lte";
            gt: "gt";
            lt: "lt";
            is_true: "is_true";
            is_false: "is_false";
            before: "before";
            after: "after";
            is_empty: "is_empty";
            is_not_empty: "is_not_empty";
        }>;
        value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TPipelineConditionGroup = z.infer<typeof PipelineConditionGroup>;
export type TPipelineRuleNode = {
    id: string;
    type: "condition";
    condition: TPipelineCondition;
} | {
    id: string;
    type: "group";
    logic: "AND" | "OR";
    children: TPipelineRuleNode[];
};
export declare const PipelineRuleNode: z.ZodType<TPipelineRuleNode>;
export declare const PipelineFormSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    sourceFormId: z.ZodString;
    sourceFormTitle: z.ZodString;
    includeGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        logic: z.ZodEnum<{
            AND: "AND";
            OR: "OR";
        }>;
        kind: z.ZodEnum<{
            include: "include";
            exclude: "exclude";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            field: z.ZodString;
            operator: z.ZodEnum<{
                in: "in";
                equals: "equals";
                not_equals: "not_equals";
                contains: "contains";
                not_contains: "not_contains";
                starts_with: "starts_with";
                not_in: "not_in";
                gte: "gte";
                lte: "lte";
                gt: "gt";
                lt: "lt";
                is_true: "is_true";
                is_false: "is_false";
                before: "before";
                after: "after";
                is_empty: "is_empty";
                is_not_empty: "is_not_empty";
            }>;
            value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>>;
    excludeGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        logic: z.ZodEnum<{
            AND: "AND";
            OR: "OR";
        }>;
        kind: z.ZodEnum<{
            include: "include";
            exclude: "exclude";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            field: z.ZodString;
            operator: z.ZodEnum<{
                in: "in";
                equals: "equals";
                not_equals: "not_equals";
                contains: "contains";
                not_contains: "not_contains";
                starts_with: "starts_with";
                not_in: "not_in";
                gte: "gte";
                lte: "lte";
                gt: "gt";
                lt: "lt";
                is_true: "is_true";
                is_false: "is_false";
                before: "before";
                after: "after";
                is_empty: "is_empty";
                is_not_empty: "is_not_empty";
            }>;
            value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>>;
    includeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
    excludeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
}, z.core.$strip>;
export type TPipelineFormSchema = z.infer<typeof PipelineFormSchema>;
export declare const BudgetPipeline: z.ZodObject<{
    id: z.ZodString;
    orgId: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<{
        draft: "draft";
        active: "active";
        inactive: "inactive";
    }>;
    grantId: z.ZodNullable<z.ZodString>;
    lineItemId: z.ZodNullable<z.ZodString>;
    sourceFormId: z.ZodNullable<z.ZodString>;
    sourceFormTitle: z.ZodNullable<z.ZodString>;
    formSchemas: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        sourceFormId: z.ZodString;
        sourceFormTitle: z.ZodString;
        includeGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            logic: z.ZodEnum<{
                AND: "AND";
                OR: "OR";
            }>;
            kind: z.ZodEnum<{
                include: "include";
                exclude: "exclude";
            }>;
            conditions: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                field: z.ZodString;
                operator: z.ZodEnum<{
                    in: "in";
                    equals: "equals";
                    not_equals: "not_equals";
                    contains: "contains";
                    not_contains: "not_contains";
                    starts_with: "starts_with";
                    not_in: "not_in";
                    gte: "gte";
                    lte: "lte";
                    gt: "gt";
                    lt: "lt";
                    is_true: "is_true";
                    is_false: "is_false";
                    before: "before";
                    after: "after";
                    is_empty: "is_empty";
                    is_not_empty: "is_not_empty";
                }>;
                value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>>;
        excludeGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            logic: z.ZodEnum<{
                AND: "AND";
                OR: "OR";
            }>;
            kind: z.ZodEnum<{
                include: "include";
                exclude: "exclude";
            }>;
            conditions: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                field: z.ZodString;
                operator: z.ZodEnum<{
                    in: "in";
                    equals: "equals";
                    not_equals: "not_equals";
                    contains: "contains";
                    not_contains: "not_contains";
                    starts_with: "starts_with";
                    not_in: "not_in";
                    gte: "gte";
                    lte: "lte";
                    gt: "gt";
                    lt: "lt";
                    is_true: "is_true";
                    is_false: "is_false";
                    before: "before";
                    after: "after";
                    is_empty: "is_empty";
                    is_not_empty: "is_not_empty";
                }>;
                value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>>;
        includeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
        excludeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
    }, z.core.$strip>>>;
    includeGroups: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        logic: z.ZodEnum<{
            AND: "AND";
            OR: "OR";
        }>;
        kind: z.ZodEnum<{
            include: "include";
            exclude: "exclude";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            field: z.ZodString;
            operator: z.ZodEnum<{
                in: "in";
                equals: "equals";
                not_equals: "not_equals";
                contains: "contains";
                not_contains: "not_contains";
                starts_with: "starts_with";
                not_in: "not_in";
                gte: "gte";
                lte: "lte";
                gt: "gt";
                lt: "lt";
                is_true: "is_true";
                is_false: "is_false";
                before: "before";
                after: "after";
                is_empty: "is_empty";
                is_not_empty: "is_not_empty";
            }>;
            value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    excludeGroups: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        logic: z.ZodEnum<{
            AND: "AND";
            OR: "OR";
        }>;
        kind: z.ZodEnum<{
            include: "include";
            exclude: "exclude";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            field: z.ZodString;
            operator: z.ZodEnum<{
                in: "in";
                equals: "equals";
                not_equals: "not_equals";
                contains: "contains";
                not_contains: "not_contains";
                starts_with: "starts_with";
                not_in: "not_in";
                gte: "gte";
                lte: "lte";
                gt: "gt";
                lt: "lt";
                is_true: "is_true";
                is_false: "is_false";
                before: "before";
                after: "after";
                is_empty: "is_empty";
                is_not_empty: "is_not_empty";
            }>;
            value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    includeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
    excludeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    createdBy: z.ZodString;
    updatedBy: z.ZodString;
}, z.core.$strip>;
export type TBudgetPipeline = z.infer<typeof BudgetPipeline>;
export declare const BudgetPipelineUpsertBody: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        inactive: "inactive";
    }>>;
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sourceFormId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sourceFormTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formSchemas: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        sourceFormId: z.ZodString;
        sourceFormTitle: z.ZodString;
        includeGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            logic: z.ZodEnum<{
                AND: "AND";
                OR: "OR";
            }>;
            kind: z.ZodEnum<{
                include: "include";
                exclude: "exclude";
            }>;
            conditions: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                field: z.ZodString;
                operator: z.ZodEnum<{
                    in: "in";
                    equals: "equals";
                    not_equals: "not_equals";
                    contains: "contains";
                    not_contains: "not_contains";
                    starts_with: "starts_with";
                    not_in: "not_in";
                    gte: "gte";
                    lte: "lte";
                    gt: "gt";
                    lt: "lt";
                    is_true: "is_true";
                    is_false: "is_false";
                    before: "before";
                    after: "after";
                    is_empty: "is_empty";
                    is_not_empty: "is_not_empty";
                }>;
                value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>>;
        excludeGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            logic: z.ZodEnum<{
                AND: "AND";
                OR: "OR";
            }>;
            kind: z.ZodEnum<{
                include: "include";
                exclude: "exclude";
            }>;
            conditions: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                field: z.ZodString;
                operator: z.ZodEnum<{
                    in: "in";
                    equals: "equals";
                    not_equals: "not_equals";
                    contains: "contains";
                    not_contains: "not_contains";
                    starts_with: "starts_with";
                    not_in: "not_in";
                    gte: "gte";
                    lte: "lte";
                    gt: "gt";
                    lt: "lt";
                    is_true: "is_true";
                    is_false: "is_false";
                    before: "before";
                    after: "after";
                    is_empty: "is_empty";
                    is_not_empty: "is_not_empty";
                }>;
                value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>>;
        includeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
        excludeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
    }, z.core.$strip>>>;
    includeGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        logic: z.ZodEnum<{
            AND: "AND";
            OR: "OR";
        }>;
        kind: z.ZodEnum<{
            include: "include";
            exclude: "exclude";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            field: z.ZodString;
            operator: z.ZodEnum<{
                in: "in";
                equals: "equals";
                not_equals: "not_equals";
                contains: "contains";
                not_contains: "not_contains";
                starts_with: "starts_with";
                not_in: "not_in";
                gte: "gte";
                lte: "lte";
                gt: "gt";
                lt: "lt";
                is_true: "is_true";
                is_false: "is_false";
                before: "before";
                after: "after";
                is_empty: "is_empty";
                is_not_empty: "is_not_empty";
            }>;
            value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>>;
    excludeGroups: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        logic: z.ZodEnum<{
            AND: "AND";
            OR: "OR";
        }>;
        kind: z.ZodEnum<{
            include: "include";
            exclude: "exclude";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            field: z.ZodString;
            operator: z.ZodEnum<{
                in: "in";
                equals: "equals";
                not_equals: "not_equals";
                contains: "contains";
                not_contains: "not_contains";
                starts_with: "starts_with";
                not_in: "not_in";
                gte: "gte";
                lte: "lte";
                gt: "gt";
                lt: "lt";
                is_true: "is_true";
                is_false: "is_false";
                before: "before";
                after: "after";
                is_empty: "is_empty";
                is_not_empty: "is_not_empty";
            }>;
            value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>>;
    includeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
    excludeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
}, z.core.$strip>;
export type TBudgetPipelineUpsertBody = z.infer<typeof BudgetPipelineUpsertBody>;
export declare const BudgetPipelineListQuery: z.ZodObject<{
    grantId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        active: "active";
        inactive: "inactive";
    }>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type TBudgetPipelineListQuery = z.infer<typeof BudgetPipelineListQuery>;
export declare const BudgetPipelineDeleteBody: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type TBudgetPipelineDeleteBody = z.infer<typeof BudgetPipelineDeleteBody>;
export declare const BudgetPipelinePreviewBody: z.ZodObject<{
    grantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lineItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sourceFormId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    includeGroups: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        logic: z.ZodEnum<{
            AND: "AND";
            OR: "OR";
        }>;
        kind: z.ZodEnum<{
            include: "include";
            exclude: "exclude";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            field: z.ZodString;
            operator: z.ZodEnum<{
                in: "in";
                equals: "equals";
                not_equals: "not_equals";
                contains: "contains";
                not_contains: "not_contains";
                starts_with: "starts_with";
                not_in: "not_in";
                gte: "gte";
                lte: "lte";
                gt: "gt";
                lt: "lt";
                is_true: "is_true";
                is_false: "is_false";
                before: "before";
                after: "after";
                is_empty: "is_empty";
                is_not_empty: "is_not_empty";
            }>;
            value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    excludeGroups: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        logic: z.ZodEnum<{
            AND: "AND";
            OR: "OR";
        }>;
        kind: z.ZodEnum<{
            include: "include";
            exclude: "exclude";
        }>;
        conditions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            field: z.ZodString;
            operator: z.ZodEnum<{
                in: "in";
                equals: "equals";
                not_equals: "not_equals";
                contains: "contains";
                not_contains: "not_contains";
                starts_with: "starts_with";
                not_in: "not_in";
                gte: "gte";
                lte: "lte";
                gt: "gt";
                lt: "lt";
                is_true: "is_true";
                is_false: "is_false";
                before: "before";
                after: "after";
                is_empty: "is_empty";
                is_not_empty: "is_not_empty";
            }>;
            value: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    includeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
    excludeTree: z.ZodOptional<z.ZodNullable<z.ZodType<TPipelineRuleNode, unknown, z.core.$ZodTypeInternals<TPipelineRuleNode, unknown>>>>;
    pipelineId: z.ZodOptional<z.ZodString>;
    month: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type TBudgetPipelinePreviewBody = z.infer<typeof BudgetPipelinePreviewBody>;
export type TPreviewItemResult = {
    itemId: string;
    matchReasons: string[];
    exclusionReasons: string[];
    conflictPipelineIds: string[];
};
export type TPreviewMatchedRow = {
    id: string;
    submissionId: string;
    amount: number;
    merchant: string;
    formTitle: string;
    source: string;
    month: string;
    customer: string;
    expenseType: string;
    grantId: string | null;
    lineItemId: string | null;
    queueStatus: string;
};
export type TBudgetPipelinePreviewResult = {
    matched: TPreviewMatchedRow[];
    totalAmount: number;
    projectedAmount?: number;
    postedAmount?: number;
    projectedCount?: number;
    postedCount?: number;
    matchCount: number;
    perItem: TPreviewItemResult[];
    conflicts: Array<{
        pipelineId: string;
        pipelineName: string;
        itemIds: string[];
    }>;
};
