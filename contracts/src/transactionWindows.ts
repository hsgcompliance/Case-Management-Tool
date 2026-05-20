export const TRANSACTION_WINDOW_FORM_IDS = {
  creditCard: "251878265158166",
  invoice: "252674777246167",
} as const;

export type TransactionWindowFormId =
  (typeof TRANSACTION_WINDOW_FORM_IDS)[keyof typeof TRANSACTION_WINDOW_FORM_IDS];

export type TransactionQuestionField = {
  rawFieldId: string;
  label: string;
  rawType?: string;
  type: "text" | "number" | "date" | "boolean" | "select";
  logicType?:
    | "dropdown"
    | "single_select"
    | "multi_select"
    | "date"
    | "text"
    | "number"
    | "email"
    | "phone"
    | "file"
    | "unknown";
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

type WindowField = TransactionQuestionField & {
  cleanLabel: string;
  key: string;
};

type PhysicalWindow = {
  orderRange: [number, number];
  fields: WindowField[];
};

const STRUCTURAL_RAW_TYPES = new Set([
  "control_head",
  "control_text",
  "control_divider",
  "control_collapse",
  "control_pagebreak",
  "control_button",
]);

export class TransactionWindowSchemaError extends Error {
  readonly code = "TRANSACTION_WINDOW_SCHEMA_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "TransactionWindowSchemaError";
  }
}

export function cleanVisibleLabel(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function transactionFieldKey(label: string): string {
  const slug = cleanVisibleLabel(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `tx:${slug || "field"}`;
}

function normalizedOptions(options?: string[]): string[] {
  return [...new Set((options ?? []).map((option) => String(option).trim()).filter(Boolean))].sort();
}

function normalizeFields(fields: readonly TransactionQuestionField[]): WindowField[] {
  return fields
    .map((field) => {
      const cleanLabel = cleanVisibleLabel(field.label);
      return {
        ...field,
        cleanLabel,
        key: transactionFieldKey(cleanLabel),
        order: Number(field.order) || 0,
      };
    })
    .filter((field) => !!field.rawFieldId && !!field.cleanLabel)
    .sort((a, b) => a.order - b.order || Number(a.rawFieldId) - Number(b.rawFieldId));
}

function isAnswerable(field: WindowField): boolean {
  return !!field.cleanLabel &&
    !STRUCTURAL_RAW_TYPES.has(String(field.rawType || "")) &&
    String(field.rawType || "") !== "control_fileupload";
}

function signature(fields: readonly WindowField[]): string {
  return fields
    .map((field) =>
      [
        field.cleanLabel.toLowerCase(),
        field.type,
        field.logicType ?? "",
      ].join("::"),
    )
    .join("||");
}

function assertSameSignature(
  windows: readonly PhysicalWindow[],
  label: string,
): void {
  if (!windows.length) {
    throw new TransactionWindowSchemaError(`${label}: no transaction windows were detected.`);
  }
  const [first, ...rest] = windows;
  const expected = signature(first.fields);
  for (const [offset, window] of rest.entries()) {
    if (signature(window.fields) !== expected) {
      throw new TransactionWindowSchemaError(
        `${label}: transaction window ${offset + 2} does not match transaction window 1.`,
      );
    }
  }
}

function buildFieldDefinitions(windows: readonly PhysicalWindow[]): TransactionFieldDefinition[] {
  const byKey = new Map<string, WindowField[]>();
  for (const window of windows) {
    for (const field of window.fields) {
      const rows = byKey.get(field.key) ?? [];
      rows.push(field);
      byKey.set(field.key, rows);
    }
  }

  return [...byKey.values()]
    .sort((a, b) => a[0].order - b[0].order)
    .map((instances) => {
      const first = instances[0];
      return {
        key: first.key,
        label: first.cleanLabel,
        type: first.type,
        logicType: first.logicType,
        typeLabel: first.typeLabel,
        rawType: first.rawType,
        options: normalizedOptions(instances.flatMap((field) => field.options ?? [])),
      };
    });
}

function toLogicalWindow(index: number, windows: readonly PhysicalWindow[]): LogicalTransactionWindow {
  const fieldIdsByKey: Record<string, string[]> = {};
  const fieldOrdersByKey: Record<string, number[]> = {};
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;

  for (const window of windows) {
    start = Math.min(start, window.orderRange[0]);
    end = Math.max(end, window.orderRange[1]);
    for (const field of window.fields) {
      fieldIdsByKey[field.key] = [...(fieldIdsByKey[field.key] ?? []), field.rawFieldId];
      fieldOrdersByKey[field.key] = [...(fieldOrdersByKey[field.key] ?? []), field.order];
    }
  }

  return {
    index,
    orderRange: [
      Number.isFinite(start) ? start : 0,
      Number.isFinite(end) ? end : 0,
    ],
    fieldIdsByKey,
    fieldOrdersByKey,
  };
}

function inferCreditCardModel(fields: readonly TransactionQuestionField[]): TransactionWindowModel {
  const rows = normalizeFields(fields);
  const returnBoundary =
    rows.find((field) => /return documentation|return record/i.test(field.cleanLabel))?.order ??
    Number.POSITIVE_INFINITY;

  const anchorOrders = new Map<number, number>();
  for (const field of rows) {
    if (field.order >= returnBoundary) continue;
    const match = field.cleanLabel.match(/\btransaction\s+(\d+)\b/i);
    if (!match) continue;
    const index = Number(match[1]);
    if (!Number.isFinite(index) || index <= 0) continue;
    anchorOrders.set(index, Math.max(anchorOrders.get(index) ?? 0, field.order));
  }

  const anchors = [...anchorOrders.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, order]) => ({index, order}));

  if (anchors.length < 2) {
    throw new TransactionWindowSchemaError(
      "credit-card: fewer than two repeated purchase transaction headers were detected.",
    );
  }

  const windows = anchors.map((anchor, offset) => {
    const nextOrder = anchors[offset + 1]?.order ?? returnBoundary;
    const windowFields = rows.filter(
      (field) => field.order > anchor.order && field.order < nextOrder && isAnswerable(field),
    );
    return {
      orderRange: [anchor.order, Number.isFinite(nextOrder) ? nextOrder - 1 : anchor.order] as [number, number],
      fields: windowFields,
    };
  });

  assertSameSignature(windows, "credit-card");

  return {
    formId: TRANSACTION_WINDOW_FORM_IDS.creditCard,
    kind: "credit-card",
    fields: buildFieldDefinitions(windows),
    windows: windows.map((window, index) => toLogicalWindow(index + 1, [window])),
  };
}

function splitByDividers(rows: readonly WindowField[]): PhysicalWindow[] {
  const blocks: PhysicalWindow[] = [];
  let pending: WindowField[] = [];
  let start = 0;
  let end = 0;

  const flush = () => {
    const fields = pending.filter(isAnswerable);
    if (fields.length) {
      blocks.push({
        orderRange: [start || fields[0].order, end || fields[fields.length - 1].order],
        fields,
      });
    }
    pending = [];
    start = 0;
    end = 0;
  };

  for (const row of rows) {
    if (String(row.rawType || "") === "control_divider") {
      flush();
      continue;
    }
    if (!start) start = row.order;
    end = row.order;
    pending.push(row);
  }
  flush();
  return blocks;
}

function suffixMatchingWindow(block: PhysicalWindow, expected: readonly WindowField[]): PhysicalWindow | null {
  if (block.fields.length < expected.length) return null;
  const suffix = block.fields.slice(block.fields.length - expected.length);
  if (signature(suffix) !== signature(expected)) return null;
  return {
    orderRange: [suffix[0].order, suffix[suffix.length - 1].order],
    fields: suffix,
  };
}

function inferRepeatedInvoiceGroups(rows: readonly WindowField[]): PhysicalWindow[][] {
  const blocks = splitByDividers(rows);
  const repeated = new Map<string, PhysicalWindow[]>();

  for (const block of blocks) {
    const sig = signature(block.fields);
    if (!sig) continue;
    const group = repeated.get(sig) ?? [];
    group.push(block);
    repeated.set(sig, group);
  }

  const signatures = [...repeated.entries()]
    .filter(([, windows]) => windows.length >= 2)
    .sort((a, b) => a[1][0].orderRange[0] - b[1][0].orderRange[0]);

  return signatures
    .map(([, windows]) => {
      const expected = windows[0].fields;
      return blocks
        .map((block) => suffixMatchingWindow(block, expected))
        .filter(Boolean) as PhysicalWindow[];
    })
    .filter((windows) => windows.length >= 2);
}

function inferInvoiceModel(fields: readonly TransactionQuestionField[]): TransactionWindowModel {
  const rows = normalizeFields(fields);
  const groups = inferRepeatedInvoiceGroups(rows);

  if (groups.length < 2) {
    throw new TransactionWindowSchemaError(
      "invoice: expected customer-side and program-side repeated transaction windows.",
    );
  }

  const [customerSide, programSide] = groups.slice(0, 2);
  assertSameSignature(customerSide, "invoice customer-side");
  assertSameSignature(programSide, "invoice program-side");

  if (customerSide.length !== programSide.length) {
    throw new TransactionWindowSchemaError(
      "invoice: customer-side and program-side transaction window counts differ.",
    );
  }

  const combinedWindows = customerSide.map((window, index) => [window, programSide[index]]);
  const logicalWindows = combinedWindows.map((pair, index) => toLogicalWindow(index + 1, pair));

  const logicalFieldWindows: PhysicalWindow[] = combinedWindows.map((pair) => {
    const byKey = new Map<string, WindowField>();
    for (const field of [...pair[0].fields, ...pair[1].fields]) {
      if (!byKey.has(field.key)) byKey.set(field.key, field);
    }
    const fieldsForSignature = [...byKey.values()].sort((a, b) => a.order - b.order);
    return {
      orderRange: [pair[0].orderRange[0], pair[1].orderRange[1]],
      fields: fieldsForSignature,
    };
  });

  assertSameSignature(logicalFieldWindows, "invoice logical");

  return {
    formId: TRANSACTION_WINDOW_FORM_IDS.invoice,
    kind: "invoice",
    fields: buildFieldDefinitions([...customerSide, ...programSide]),
    windows: logicalWindows,
  };
}

export function inferTransactionWindowModel(
  formId: string,
  fields: readonly TransactionQuestionField[],
): TransactionWindowModel {
  if (formId === TRANSACTION_WINDOW_FORM_IDS.creditCard) {
    return inferCreditCardModel(fields);
  }
  if (formId === TRANSACTION_WINDOW_FORM_IDS.invoice) {
    return inferInvoiceModel(fields);
  }
  throw new TransactionWindowSchemaError(`unsupported form "${formId}" for transaction window inference.`);
}
