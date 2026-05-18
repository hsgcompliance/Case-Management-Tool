"use client";

import React from "react";
import RefreshButton from "@entities/ui/RefreshButton";
import Modal from "@entities/ui/Modal";
import ActionMenu from "@entities/ui/ActionMenu";
import { qk } from "@hooks/queryKeys";
import {
  useInviteUser,
  useSetUserActive,
  useSetUserRole,
  useUsersList,
  type CompositeUser,
} from "@hooks/useUsers";
import { toApiError } from "@client/api";
import { toast } from "@lib/toast";
import { topRoleNormalized, normalizeRole, isDevLike } from "@lib/roles";
import { useAuth } from "@app/auth/AuthProvider";
import Inbox from "@client/inbox";

const PAGE_SIZE = 50;
const TAGS = ["casemanager", "compliance"] as const;
type Tag = (typeof TAGS)[number];
type ManagedTopRole = "viewer" | "user" | "admin" | "dev" | "org_dev" | "super_dev";

const ROLE_OPTIONS: Array<{ value: ManagedTopRole; label: string; rank: number }> = [
  { value: "viewer", label: "Viewer", rank: 1 },
  { value: "user", label: "User", rank: 2 },
  { value: "admin", label: "Admin", rank: 3 },
  { value: "dev", label: "Dev", rank: 4 },
  { value: "org_dev", label: "Org Dev", rank: 4 },
  { value: "super_dev", label: "Super Dev", rank: 5 },
];

// Always offer these three in the invite form — the page is already admin-gated.
const INVITE_ROLE_OPTIONS: Array<{ value: ManagedTopRole; label: string }> = [
  { value: "viewer", label: "Viewer" },
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
];

function topRoleRank(role: string) {
  const norm = normalizeRole(role);
  return ROLE_OPTIONS.find((opt) => opt.value === norm)?.rank ?? 0;
}

function normalizeTags(input: unknown): Tag[] {
  const raw = Array.isArray(input) ? input : [];
  const out = raw
    .map((x) => String(x || "").toLowerCase())
    .filter((x): x is Tag => x === "casemanager" || x === "compliance");
  return Array.from(new Set(out));
}

function topRoleOf(u: CompositeUser): "admin" | "user" | "unverified" | "public_user" | string {
  return topRoleNormalized(u, "unverified");
}

function isPendingApproval(u: CompositeUser): boolean {
  const top = topRoleOf(u);
  if (top === "unverified" || top === "public_user") return true;
  if (!u.active) return true;
  return false;
}

function roleBadgeClass(topRole: string) {
  if (topRole === "viewer") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300";
  if (topRole === "admin") return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300";
  if (topRole === "user") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-900/20 dark:text-sky-300";
  if (topRole === "unverified" || topRole === "public_user") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300";
}

function EmailName({ user }: { user: CompositeUser }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-slate-900 dark:text-slate-100">{user.displayName || user.email || user.uid}</div>
      <div className="text-xs text-slate-500 truncate">{user.email || user.uid}</div>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 min-h-5 break-words text-sm text-slate-900 dark:text-slate-100">{value || "-"}</div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { user: authedUser, profile } = useAuth();
  const viewerTopRole = topRoleNormalized(profile as any, "");
  const viewerRank = topRoleRank(viewerTopRole);
  const canCrossOrgManage = isDevLike(profile as any);
  if (process.env.NODE_ENV !== "production") {
    console.debug("[UserAdmin] role debug", { profileTopRole: profile?.topRole, viewerTopRole, viewerRank, canCrossOrgManage });
  }
  const assignableRoles = React.useMemo(
    () => ROLE_OPTIONS.filter((opt) => opt.rank <= viewerRank),
    [viewerRank],
  );
  const [pageToken, setPageToken] = React.useState<string | undefined>(undefined);
  const [stack, setStack] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<"all" | "active" | "inactive">("all");
  const [listOrgId, setListOrgId] = React.useState("");

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [inviteTopRole, setInviteTopRole] = React.useState<ManagedTopRole>("user");
  const [inviteSendEmail, setInviteSendEmail] = React.useState(true);
  const [inviteTags, setInviteTags] = React.useState<Tag[]>(["casemanager"]);
  const [continueUrl, setContinueUrl] = React.useState("");
  const [inviteOrgId, setInviteOrgId] = React.useState("");
  const [inviteTeamIds, setInviteTeamIds] = React.useState("");

  const [rowTags, setRowTags] = React.useState<Record<string, Tag[]>>({});
  const [sendingDigest, setSendingDigest] = React.useState(false);
  const [detailUser, setDetailUser] = React.useState<CompositeUser | null>(null);
  const [editDisplayName, setEditDisplayName] = React.useState("");
  const [editTopRole, setEditTopRole] = React.useState<ManagedTopRole>("user");

  const {
    data,
    isFetching: loading,
    isError,
    error,
    refetch,
  } = useUsersList({
    limit: PAGE_SIZE,
    pageToken,
    status,
    ...(canCrossOrgManage && listOrgId.trim() ? { orgId: listOrgId.trim() } : {}),
  });

  const inviteMut = useInviteUser();
  const setRoleMut = useSetUserRole();
  const setActiveMut = useSetUserActive();

  const items = data?.users || [];
  const next = data?.nextPageToken || null;
  const busy =
    inviteMut.isPending ||
    setRoleMut.isPending ||
    setActiveMut.isPending;

  React.useEffect(() => {
    setRowTags((prev) => {
      const nextState = { ...prev };
      for (const u of items) {
        if (!nextState[u.uid]) nextState[u.uid] = normalizeTags(u.roles);
      }
      return nextState;
    });
  }, [items]);

  const pendingUsers = React.useMemo(() => items.filter(isPendingApproval), [items]);
  const selectedUser = React.useMemo(
    () => (detailUser ? items.find((u) => u.uid === detailUser.uid) || detailUser : null),
    [detailUser, items]
  );

  const onNext = () => {
    if (!next) return;
    setStack((s) => [...s, pageToken || ""]);
    setPageToken(next);
  };

  const onPrev = () => {
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1] || undefined;
    setStack((s) => s.slice(0, -1));
    setPageToken(prev);
  };

  const toggleInviteTag = (tag: Tag) => {
    setInviteTags((prev) => {
      const has = prev.includes(tag);
      if (has) return prev.filter((t) => t !== tag);
      return [...prev, tag];
    });
  };

  const isSelf = (u: CompositeUser) => authedUser?.uid && u.uid === authedUser.uid;

  const openUserDetail = (u: CompositeUser) => {
    setDetailUser(u);
    setEditDisplayName(String(u.displayName || ""));
    setEditTopRole((topRoleOf(u) as ManagedTopRole) || "user");
  };

  const persistTags = async (u: CompositeUser, tags: Tag[]) => {
    if (tags.length === 0) {
      toast("At least one role is required.", { type: "error" });
      return;
    }
    try {
      await setRoleMut.mutateAsync({
        uid: u.uid,
        roles: tags,
      } as any);
      toast("Role tags saved.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const onTagToggle = (u: CompositeUser, tag: Tag, checked: boolean) => {
    const current = rowTags[u.uid] || normalizeTags(u.roles);
    const nextTags = checked ? Array.from(new Set([...current, tag])) : current.filter((t) => t !== tag);
    setRowTags((prev) => ({ ...prev, [u.uid]: nextTags }));
    void persistTags(u, nextTags);
  };

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      toast("Invite email is required.", { type: "error" });
      return;
    }
    if (inviteTopRole !== "viewer" && inviteTags.length === 0) {
      toast("Select at least one role.", { type: "error" });
      return;
    }
    if (topRoleRank(inviteTopRole) > viewerRank) {
      toast("You cannot assign a role above your own rank.", { type: "error" });
      return;
    }
    try {
      const result = await inviteMut.mutateAsync({
        email,
        name: inviteName.trim(),
        roles: inviteTopRole === "viewer" ? [] : inviteTags,
        topRole: inviteTopRole,
        sendEmail: inviteSendEmail,
        ...(canCrossOrgManage && inviteOrgId.trim() ? { orgId: inviteOrgId.trim() } : {}),
        ...(canCrossOrgManage && inviteTeamIds.trim()
          ? {
              teamIds: inviteTeamIds
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(continueUrl.trim() ? { continueUrl: continueUrl.trim() } : {}),
      } as any);
      if ((result as any)?.user?.inviteEmail?.ok === false) {
        toast("User added, but invite email was not sent.", { type: "warning" });
      } else {
        toast("User invited.", { type: "success" });
      }
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setContinueUrl("");
      setInviteTopRole("user");
      setInviteSendEmail(true);
      setInviteTags(["casemanager"]);
      setInviteOrgId("");
      setInviteTeamIds("");
      void refetch();
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const resendInvite = async (u: CompositeUser) => {
    if (!u.email) {
      toast("This user does not have an email address.", { type: "error" });
      return;
    }
    try {
      const result = await inviteMut.mutateAsync({
        email: u.email,
        name: u.displayName || "",
        roles: Array.isArray(u.roles) ? u.roles : [],
        topRole: (u.topRole as any) || "user",
        sendEmail: true,
      } as any);
      if ((result as any)?.user?.inviteEmail?.ok === false) {
        toast("Invite email was not sent.", { type: "warning" });
      } else {
        toast("Invite email sent.", { type: "success" });
      }
      void refetch();
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const saveDisplayName = async () => {
    if (!selectedUser) return;
    try {
      const result = await setRoleMut.mutateAsync({
        uid: selectedUser.uid,
        displayName: editDisplayName.trim() || null,
      } as any);
      const nextUser = ((result as any)?.user || selectedUser) as CompositeUser;
      setDetailUser(nextUser);
      setEditDisplayName(String(nextUser.displayName || ""));
      toast("Display name saved.", { type: "success" });
      void refetch();
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const approveUser = async (u: CompositeUser) => {
    const tags = rowTags[u.uid] || normalizeTags(u.roles);
    if (tags.length === 0) {
      toast("Select at least one role before approval.", { type: "error" });
      return;
    }
    if (isSelf(u)) {
      toast("Use another admin account to approve your own account.", { type: "error" });
      return;
    }
    try {
      await setRoleMut.mutateAsync({
        uid: u.uid,
        roles: tags,
        topRole: "user",
      } as any);
      if (!u.active) {
        await setActiveMut.mutateAsync({ uid: u.uid, active: true } as any);
      }
      toast("User approved.", { type: "success" });
      void refetch();
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const setTopRole = async (u: CompositeUser, topRole: ManagedTopRole) => {
    const tags = rowTags[u.uid] || normalizeTags(u.roles);
    if (topRole !== "viewer" && tags.length === 0) {
      toast("Select at least one role.", { type: "error" });
      return;
    }
    if (isSelf(u)) {
      toast("Use another admin account to change your own access level.", { type: "error" });
      return;
    }
    if (topRoleRank(topRole) > viewerRank) {
      toast("You cannot assign a role above your own rank.", { type: "error" });
      return;
    }
    try {
      await setRoleMut.mutateAsync({
        uid: u.uid,
        roles: topRole === "viewer" ? [] : tags,
        topRole,
      } as any);
      toast(`Access set to ${topRole}.`, { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  const toggleActive = async (u: CompositeUser, nextActive: boolean) => {
    if (isSelf(u) && !nextActive) {
      toast("Use another admin account to deactivate yourself.", { type: "error" });
      return;
    }
    try {
      await setActiveMut.mutateAsync({ uid: u.uid, active: nextActive } as any);
      toast(nextActive ? "User activated." : "User deactivated.", { type: "success" });
    } catch (e: unknown) {
      toast(toApiError(e).error, { type: "error" });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manage Users</h1>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" onClick={() => setInviteOpen(true)}>
            Invite User
          </button>
          <button
            className="btn btn-sm"
            disabled={sendingDigest}
            onClick={async () => {
              const d = new Date();
              const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              setSendingDigest(true);
              try {
                const r = await Inbox.sendDigestNow({ months: [month] }) as any;
                toast(`Digest sent to ${r.sent ?? "?"} CM${r.sent !== 1 ? "s" : ""}${r.skipped ? ` (${r.skipped} already sent)` : ""}.`, { type: "success" });
              } catch (e: any) {
                toast(e?.message || "Digest send failed.", { type: "error" });
              } finally {
                setSendingDigest(false);
              }
            }}
          >
            {sendingDigest ? "Sending…" : "Send Digest Emails Now"}
          </button>
          <RefreshButton className="btn btn-sm" queryKeys={[qk.users.root]} onRefresh={() => void refetch()} label="Refresh" />
        </div>
      </div>

      <Modal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={<span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Invite User</span>}
        widthClass="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setInviteOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-sm" onClick={invite} disabled={busy}>
              {inviteMut.isPending ? "Inviting..." : "Send Invite"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-xs text-slate-600">Email</span>
            <input
              className="input mt-1"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.currentTarget.value)}
              placeholder="user@org.com"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-slate-600">Name</span>
            <input
              className="input mt-1"
              value={inviteName}
              onChange={(e) => setInviteName(e.currentTarget.value)}
              placeholder="Display name"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-slate-600">Role</span>
            <select
              className="select mt-1"
              value={inviteTopRole}
              onChange={(e) =>
                setInviteTopRole(e.currentTarget.value as ManagedTopRole)
              }
            >
              {INVITE_ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs text-slate-600">Continue URL (full next link)</span>
            <input
              className="input mt-1"
              value={continueUrl}
              onChange={(e) => setContinueUrl(e.currentTarget.value)}
              placeholder="http://localhost:5173/login"
            />
          </label>
          {canCrossOrgManage && (
            <label className="text-sm">
              <span className="text-xs text-slate-600">Org ID (optional override)</span>
              <input
                className="input mt-1"
                value={inviteOrgId}
                onChange={(e) => setInviteOrgId(e.currentTarget.value)}
                placeholder="HRDC_IX"
              />
            </label>
          )}
          {canCrossOrgManage && (
            <label className="text-sm">
              <span className="text-xs text-slate-600">Team IDs (comma-separated)</span>
              <input
                className="input mt-1"
                value={inviteTeamIds}
                onChange={(e) => setInviteTeamIds(e.currentTarget.value)}
                placeholder="HRDC_IX, TEAM_A"
              />
            </label>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          {inviteTopRole !== "viewer" && TAGS.map((tag) => (
            <label key={tag} className="inline-flex items-center gap-2">
              <input type="checkbox" checked={inviteTags.includes(tag)} onChange={() => toggleInviteTag(tag)} />
              <span>{tag}</span>
            </label>
          ))}
          <label className="inline-flex items-center gap-2 ml-auto">
            <input
              type="checkbox"
              checked={inviteSendEmail}
              onChange={(e) => setInviteSendEmail(e.currentTarget.checked)}
            />
            <span>Send invite email</span>
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={!!selectedUser}
        onClose={() => setDetailUser(null)}
        title={<span className="text-sm font-semibold text-slate-800 dark:text-slate-100">User Details</span>}
        widthClass="max-w-3xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {selectedUser && (
              <button
                className="btn btn-secondary"
                onClick={() => void resendInvite(selectedUser)}
                disabled={busy || !selectedUser.email}
              >
                {inviteMut.isPending ? "Sending..." : "Send Invite Email Again"}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setDetailUser(null)} disabled={busy}>
              Close
            </button>
          </div>
        }
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                {selectedUser.displayName || selectedUser.email || selectedUser.uid}
              </div>
              <div className="mt-1 text-sm text-slate-500">{selectedUser.email || selectedUser.uid}</div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField label="UID" value={selectedUser.uid} />
              <DetailField label="Email" value={selectedUser.email || "-"} />
              <DetailField label="Access" value={topRoleOf(selectedUser)} />
              <DetailField label="Status" value={selectedUser.active ? "active" : "inactive"} />
              <DetailField label="Created" value={formatDateTime(selectedUser.createdAt)} />
              <DetailField label="Last Login" value={formatDateTime(selectedUser.lastLogin)} />
              <DetailField label="Org ID" value={(selectedUser as any).orgId || "-"} />
              <DetailField
                label="Teams"
                value={Array.isArray((selectedUser as any).teamIds) && (selectedUser as any).teamIds.length
                  ? (selectedUser as any).teamIds.join(", ")
                  : "-"}
              />
            </div>

            <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Access Level</div>
              {isSelf(selectedUser) ? (
                <p className="text-xs text-slate-500">You cannot change your own access level.</p>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    className="select text-sm"
                    value={editTopRole}
                    onChange={(e) => setEditTopRole(e.currentTarget.value as ManagedTopRole)}
                    disabled={busy}
                  >
                    {INVITE_ROLE_OPTIONS.filter((r) => topRoleRank(r.value) <= (viewerRank || 3)).map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-sm"
                    disabled={busy || editTopRole === topRoleOf(selectedUser)}
                    onClick={() => void setTopRole(selectedUser, editTopRole)}
                  >
                    {setRoleMut.isPending ? "Saving…" : "Save Access"}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Role</div>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((tag) => (
                  <label key={tag} className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={(rowTags[selectedUser.uid] || normalizeTags(selectedUser.roles)).includes(tag)}
                      onChange={(e) => onTagToggle(selectedUser, tag, e.currentTarget.checked)}
                      disabled={busy}
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
              <label className="text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Display Name</span>
                <div className="mt-2 flex gap-2">
                  <input
                    className="input"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.currentTarget.value)}
                    placeholder="Display name"
                    disabled={busy}
                  />
                  <button className="btn btn-sm" onClick={() => void saveDisplayName()} disabled={busy}>
                    {setRoleMut.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              </label>
            </div>
          </div>
        )}
      </Modal>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-slate-800">Pending Approvals</h2>
        {pendingUsers.length === 0 ? (
          <p className="text-sm text-slate-600">No pending users on this page.</p>
        ) : (
          <div className="space-y-2">
            {pendingUsers.map((u) => (
              <div key={u.uid} className="rounded border border-amber-200 bg-amber-50 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <EmailName user={u} />
                  <span className="inline-flex rounded-full border border-amber-300 px-2 py-0.5 text-xs text-amber-800">
                    {topRoleOf(u)}
                  </span>
                  <div className="flex items-center gap-2">
                    {TAGS.map((tag) => (
                      <label key={tag} className="inline-flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={(rowTags[u.uid] || normalizeTags(u.roles)).includes(tag)}
                          onChange={(e) => onTagToggle(u, tag, e.currentTarget.checked)}
                          disabled={busy}
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-sm ml-auto" onClick={() => void approveUser(u)} disabled={busy || !!isSelf(u)}>
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Users</h2>
          <div className="flex items-center gap-2">
            {canCrossOrgManage && (
              <>
                <label className="text-xs text-slate-600">Org</label>
                <input
                  className="input w-36 px-2 py-1 text-xs"
                  placeholder="all orgs"
                  value={listOrgId}
                  onChange={(e) => {
                    setListOrgId(e.currentTarget.value);
                    setPageToken(undefined);
                    setStack([]);
                  }}
                />
              </>
            )}
            <label className="text-xs text-slate-600">Status</label>
            <select
              className="select px-2 py-1 text-xs"
              value={status}
              onChange={(e) => {
                setStatus(e.currentTarget.value as "all" | "active" | "inactive");
                setPageToken(undefined);
                setStack([]);
              }}
            >
              <option value="all">all</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left border-b bg-slate-50">
            <tr>
              <th className="p-2">User</th>
              <th className="p-2">Access</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
              <th className="p-2">Last Login</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-3" colSpan={6}>Loading...</td></tr>}
            {isError && !loading && (
              <tr><td className="p-3 text-red-600" colSpan={6}>Error: {(error as Error)?.message || "failed"}</td></tr>
            )}
            {!loading && !isError && items.length === 0 && <tr><td className="p-3" colSpan={6}>No results.</td></tr>}
            {items.map((u) => {
              const top = topRoleOf(u);
              const tags = rowTags[u.uid] || normalizeTags(u.roles);
              return (
                <tr key={u.uid} className="border-t align-top">
                  <td className="p-2">
                    <button
                      type="button"
                      className="block max-w-full text-left hover:underline"
                      onClick={() => openUserDetail(u)}
                    >
                      <EmailName user={u} />
                    </button>
                  </td>
                  <td className="p-2">
                    <span className={["inline-flex rounded-full border px-2 py-0.5 text-xs", roleBadgeClass(top)].join(" ")}>
                      {top}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      {TAGS.map((tag) => (
                        <label key={tag} className="inline-flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={tags.includes(tag)}
                            onChange={(e) => onTagToggle(u, tag, e.currentTarget.checked)}
                            disabled={busy}
                          />
                          {tag}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="p-2">{u.active ? "active" : "inactive"}</td>
                  <td className="p-2 text-xs text-slate-600">{formatDateTime(u.lastLogin)}</td>
                  <td className="p-2 text-right">
                    <ActionMenu
                      disabled={busy}
                      items={[
                        { key: "details", label: "View Details", onSelect: () => openUserDetail(u) },
                        { key: "resend-invite", label: "Send Invite Email Again", onSelect: () => resendInvite(u), disabled: !u.email },
                        ...assignableRoles.map((role) => ({
                          key: `set-${role.value}`,
                          label: `Set ${role.label}`,
                          onSelect: () => setTopRole(u, role.value),
                          disabled: !!isSelf(u) || top === role.value,
                        })),
                        {
                          key: "toggle-active",
                          label: u.active ? "Deactivate" : "Activate",
                          onSelect: () => toggleActive(u, !u.active),
                          disabled: !!isSelf(u) && !!u.active,
                          danger: !!u.active,
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-slate-200 p-2 dark:border-slate-700">
          <button className="btn btn-sm" onClick={onPrev} disabled={loading || stack.length === 0}>
            Prev
          </button>
          <span className="text-xs opacity-70">{items.length} / {PAGE_SIZE}</span>
          <button className="btn btn-sm" onClick={onNext} disabled={loading || !next}>
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

export { AdminUsersPage };
