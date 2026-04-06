//src/app/(protected)/loading.tsx
export default function ProtectedLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-800 dark:border-slate-700 dark:border-t-slate-200" />
    </div>
  );
}
