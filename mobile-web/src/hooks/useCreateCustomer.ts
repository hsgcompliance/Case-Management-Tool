import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@hooks/queryKeys";
import type { User } from "firebase/auth";
import { callFunction } from "@/lib/functionsApi";

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  dob?: string;
  cwId?: string;
  hmisId?: string;
  phone?: string;
  email?: string;
  population?: string;
  caseManagerId?: string;
  caseManagerName?: string;
  secondaryCaseManagerId?: string;
  secondaryCaseManagerName?: string;
}

export function useCreateCustomer(_user: User | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCustomerInput): Promise<string> => {
      const result = await callFunction<{ ok: boolean; ids: string[] }>(
        "customersUpsert",
        [input],
      );
      const id = result.ids?.[0];
      if (!id) throw new Error("No customer ID returned from server");
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.customers.root });
    },
  });
}
