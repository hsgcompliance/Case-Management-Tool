export declare const TRANSACTION_WINDOW_FORM_IDS: {
    readonly creditCard: "251878265158166";
    readonly invoice: "252674777246167";
};
export type TransactionWindowFormId = (typeof TRANSACTION_WINDOW_FORM_IDS)[keyof typeof TRANSACTION_WINDOW_FORM_IDS];
export type TransactionQuestionField = {
    rawFieldId: string;
    label: string;
    rawType?: string;
    type: "text" | "number" | "date" | "boolean" | "select";
    logicType?: "dropdown" | "single_select" | "multi_select" | "date" | "text" | "number" | "email" | "phone" | "file" | "unknown";
    typeLabel?: string;
    options?: string[];
    order: number;
};
export type TransactionFieldDefinition = {
    key: string;
    label: string;
    type: TransactionQuestionField["type"];
    logicType?: TransactionQuestionField["logicType"];
    typeLabel?: string;
    rawType?: string;
    options?: string[];
};
export type LogicalTransactionWindow = {
    index: number;
    orderRange: [number, number];
    fieldIdsByKey: Record<string, string[]>;
    fieldOrdersByKey: Record<string, number[]>;
};
export type TransactionWindowModel = {
    formId: TransactionWindowFormId;
    kind: "credit-card" | "invoice";
    fields: TransactionFieldDefinition[];
    windows: LogicalTransactionWindow[];
};
export declare class TransactionWindowSchemaError extends Error {
    readonly code = "TRANSACTION_WINDOW_SCHEMA_ERROR";
    constructor(message: string);
}
export declare function cleanVisibleLabel(value: unknown): string;
export declare function transactionFieldKey(label: string): string;
export declare function inferTransactionWindowModel(formId: string, fields: readonly TransactionQuestionField[]): TransactionWindowModel;
