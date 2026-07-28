import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiCall, idemKey } = vi.hoisted(() => ({
  apiCall: vi.fn(),
  idemKey: vi.fn(() => "idem"),
}));

vi.mock("./api", () => ({
  default: {
    call: apiCall,
  },
}));

vi.mock("@lib/idem", () => ({ idemKey }));

describe("FormSessions.create", () => {
  beforeEach(() => {
    apiCall.mockReset();
    idemKey.mockClear();
  });

  it("converts blank optional ids to null before calling createFormSession", async () => {
    apiCall.mockResolvedValue({ ok: true });
    const { default: FormSessions } = await import("./formSessions");

    await FormSessions.create({
      workflowId: "invoice-request",
      customerId: "",
      userId: "  ",
      caseManagerId: null,
      grantId: " grant-1 ",
      paymentQueueId: "queue-1",
      ledgerItemId: undefined,
      creditCardId: "",
    });

    const expectedBody = {
      source: "main_app",
      workflowId: "invoice-request",
      customerId: null,
      userId: null,
      caseManagerId: null,
      grantId: "grant-1",
      paymentQueueId: "queue-1",
      ledgerItemId: null,
      creditCardId: null,
    };
    expect(apiCall).toHaveBeenCalledWith("createFormSession", {
      body: expectedBody,
      idempotencyKey: "idem",
    });
    expect(idemKey).toHaveBeenCalledWith({
      scope: "formSession",
      op: "create",
      input: expectedBody,
    });
  });
});
