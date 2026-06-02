import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callFunction } from "@/lib/functionsApi";
import { qk } from "@hooks/queryKeys";

export interface EnrollCustomerInput {
  customerId: string;
  customerName: string;
  grantId: string;
  grantName: string;
  caseManagerId?: string;
  caseManagerName?: string;
  startDate: string;
  endDate?: string;
}

export function useEnrollCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EnrollCustomerInput): Promise<string> => {
      const result = await callFunction<{ ok: boolean; ids: string[] }>("enrollmentsUpsert", [{
        customerId: input.customerId,
        customerName: input.customerName,
        grantId: input.grantId,
        grantName: input.grantName,
        startDate: input.startDate,
        endDate: input.endDate || undefined,
        caseManagerId: input.caseManagerId || undefined,
        caseManagerName: input.caseManagerName || undefined,
        generateTaskSchedule: true,
      }]);
      const id = result.ids?.[0];
      if (!id) throw new Error("Enrollment creation returned no ID");
      return id;
    },
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: qk.enrollments.byCustomer(vars.customerId) });
      qc.invalidateQueries({ queryKey: qk.customers.root });
    },
  });
}
