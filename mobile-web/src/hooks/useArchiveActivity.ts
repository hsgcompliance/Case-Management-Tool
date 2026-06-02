import { useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";

export function useArchiveActivity(uid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (activityId: string) =>
      updateDoc(doc(db, "cmActivities", activityId), { archived: true }),
    onSuccess: () => {
      // Invalidate entire cmActivities root — covers feed (all type filters) + byCustomer.
      qc.invalidateQueries({ queryKey: qk.cmActivities.root });
    },
  });
}
