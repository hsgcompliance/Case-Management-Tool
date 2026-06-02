import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { qk } from "@hooks/queryKeys";
import { RQ_DEFAULTS } from "@hooks/base";

export interface MobilePrefs {
  timeFormat: "12h" | "24h";
  timeInterval: 5 | 15;
  calendarDefault: boolean;
  googleIntegrationModes: {
    googleCalendar: "permanent" | "temporary" | "off";
    googleDrive: "permanent" | "temporary" | "off";
  };
}

const DEFAULTS: MobilePrefs = {
  timeFormat: "12h",
  timeInterval: 15,
  calendarDefault: false,
  googleIntegrationModes: { googleCalendar: "off", googleDrive: "off" },
};

function integrationMode(raw: unknown): "permanent" | "temporary" | "off" {
  return raw === "permanent" || raw === "temporary" || raw === "off" ? raw : "off";
}

export function useUserPrefs(uid: string | undefined) {
  const qc = useQueryClient();

  const query_ = useQuery<MobilePrefs>({
    queryKey: qk.userPrefs.me(uid ?? ""),
    queryFn: async () => {
      const snap = await getDoc(doc(db, "userExtras", uid!));
      const s = ((snap.data() ?? {}).settings ?? {}) as Record<string, unknown>;
      return {
        timeFormat: (["12h", "24h"].includes(s.timeFormat as string)
          ? s.timeFormat
          : "12h") as "12h" | "24h",
        timeInterval: ([5, 15].includes(s.timeInterval as number)
          ? s.timeInterval
          : 15) as 5 | 15,
        calendarDefault: s.calendarDefault === true,
        googleIntegrationModes: {
          googleCalendar: integrationMode((s.googleIntegrationModes as Record<string, unknown> | undefined)?.googleCalendar),
          googleDrive: integrationMode((s.googleIntegrationModes as Record<string, unknown> | undefined)?.googleDrive),
        },
      };
    },
    enabled: !!uid,
    ...RQ_DEFAULTS,
    staleTime: 10 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<MobilePrefs>) => {
      await setDoc(doc(db, "userExtras", uid!), { settings: patch }, { merge: true });
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.userPrefs.me(uid ?? "") });
      const prev = qc.getQueryData<MobilePrefs>(qk.userPrefs.me(uid ?? ""));
      qc.setQueryData<MobilePrefs>(qk.userPrefs.me(uid ?? ""), (old) => ({
        ...(old ?? DEFAULTS),
        ...patch,
      }));
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.userPrefs.me(uid ?? ""), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.userPrefs.me(uid ?? "") });
    },
  });

  return {
    prefs: query_.data ?? DEFAULTS,
    updatePrefs: mutation.mutate,
    updatePrefsAsync: mutation.mutateAsync,
    updatingPrefs: mutation.isPending,
  };
}
