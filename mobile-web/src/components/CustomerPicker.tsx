import { useState } from "react";
import { useOrgCustomers } from "@/hooks/useCustomers";
import type { User } from "firebase/auth";

export interface CustomerOption {
  id: string;
  name: string;
  status: string;
}

interface Props {
  user: User;
  value: CustomerOption | null;
  onChange: (c: CustomerOption | null) => void;
}

export function CustomerPicker({ user, value, onChange }: Props) {
  const { data: customers = [], isLoading } = useOrgCustomers(user);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = search.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : customers;

  if (value && !open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setSearch(""); }}
        className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
      >
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Customer</p>
          <p className="font-medium text-slate-900">{value.name}</p>
        </div>
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-300 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          autoFocus
          type="search"
          placeholder="Search any customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {value && (
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 flex-shrink-0">
            Cancel
          </button>
        )}
      </div>

      <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
        {isLoading && (
          <p className="px-4 py-3 text-sm text-slate-400">Loading customers…</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="px-4 py-3 text-sm text-slate-400">
            {search ? `No customers matching "${search}"` : "No customers found"}
          </p>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { onChange({ id: c.id, name: c.name, status: c.status ?? "active" }); setOpen(false); setSearch(""); }}
            className="w-full px-4 py-3 text-left text-sm active:bg-indigo-50 transition-colors"
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
