import { useAuth } from "@/hooks/useAuth";
import { useCmActivities } from "@/hooks/useCmActivities";
import { ActivityCard } from "@/components/ActivityCard";
import { useNavigate } from "react-router-dom";

// LOCAL date, not UTC — evening sessions must count toward today's stats.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function greeting(name: string | null) {
  const hour = new Date().getHours();
  const time = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name?.split(" ")[0] ?? "";
  return first ? `${time}, ${first}` : time;
}

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = todayISO();

  const { data: activities = [], isLoading } = useCmActivities(user?.uid, {
    month: today.slice(0, 7),
    maxItems: 50,
  });

  const todayActivities = activities.filter((a) => a.date === today);

  return (
    <div className="page-content bg-slate-50">
      {/* Header */}
      <div className="bg-indigo-600 px-5 pt-12 pb-8 text-white">
        <p className="text-indigo-200 text-sm">{greeting(user?.displayName ?? null)}</p>
        <h1 className="mt-1 text-2xl font-bold">Today</h1>
        <p className="mt-0.5 text-indigo-200 text-sm">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatChip label="Today's sessions" value={todayActivities.length} />
          <StatChip label="This month" value={activities.length} />
        </div>
      </div>

      {/* Today's activities */}
      <div className="px-4 pt-5 pb-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Today's Log</h2>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && todayActivities.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <p className="text-sm">No sessions logged today</p>
            <p className="text-xs mt-1">Tap + to record one</p>
          </div>
        )}

        {todayActivities.map((a) => (
          <ActivityCard key={a.id} activity={a} />
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/log")}
        className="fixed bottom-20 right-5 h-14 w-14 rounded-full bg-indigo-600 shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform z-40"
        style={{ marginBottom: "var(--safe-bottom)" }}
        aria-label="Log activity"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-indigo-500/40 px-3 py-2.5">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-indigo-200 mt-0.5">{label}</p>
    </div>
  );
}
