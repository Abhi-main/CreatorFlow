/* This page groups profile, connected-account, invite, and preference settings. */
import { useEffect, useState } from "react";
import { accountsApi, notificationsApi, teamsApi, usersApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { DataTable, PageCard, PaginationControls } from "../components/shared/Ui";

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState({ items: [], pagination: null });
  const [members, setMembers] = useState({ items: [], pagination: null });
  const [invite, setInvite] = useState({ full_name: "", email: "", role_name: "viewer" });
  const [prefs, setPrefs] = useState({ publishAlerts: true, weeklyEmail: true });

  useEffect(() => {
    Promise.all([
      usersApi.getMe(),
      accountsApi.list(),
      teamsApi.listMembers(user.team_id),
      notificationsApi.list()
    ]).then(([profileData, accountsData, membersData]) => {
      setProfile(profileData);
      setAccounts(accountsData);
      setMembers(membersData);
    });
  }, [user.team_id]);

  if (!profile) {
    return <PageCard title="Settings"><p>Loading settings...</p></PageCard>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <PageCard title="Profile">
          <div className="grid gap-4">
            <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" value={profile.full_name} onChange={(event) => setProfile((current) => ({ ...current, full_name: event.target.value }))} />
            <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" value={profile.timezone} onChange={(event) => setProfile((current) => ({ ...current, timezone: event.target.value }))} />
            <button type="button" onClick={async () => setProfile(await usersApi.updateMe(profile))} className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950">Save profile</button>
          </div>
        </PageCard>

        <PageCard title="Notification preferences">
          <div className="space-y-4 text-sm text-slate-300">
            <label className="flex items-center gap-3"><input type="checkbox" checked={prefs.publishAlerts} onChange={(event) => setPrefs((current) => ({ ...current, publishAlerts: event.target.checked }))} /> Publish alerts</label>
            <label className="flex items-center gap-3"><input type="checkbox" checked={prefs.weeklyEmail} onChange={(event) => setPrefs((current) => ({ ...current, weeklyEmail: event.target.checked }))} /> Weekly summary email</label>
          </div>
        </PageCard>
      </section>

      <PageCard title="Connected accounts manager">
        <DataTable
          columns={[
            { key: "account_name", label: "Account" },
            { key: "status", label: "Status" },
            { key: "followers", label: "Followers", render: (row) => row.follower_count.toLocaleString() },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex gap-2">
                  <button type="button" onClick={async () => setAccounts(await accountsApi.list())} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-100">Refresh</button>
                  <button type="button" onClick={async () => { await accountsApi.sync(row.id); setAccounts(await accountsApi.list()); }} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-emerald-300">Sync</button>
                </div>
              )
            }
          ]}
          rows={accounts.items}
        />
      </PageCard>

      <PageCard title="Team members and invites">
        <form
          className="mb-6 grid gap-4 md:grid-cols-[1fr_1fr_180px_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            await teamsApi.inviteMember(user.team_id, invite);
            setMembers(await teamsApi.listMembers(user.team_id));
            setInvite({ full_name: "", email: "", role_name: "viewer" });
          }}
        >
          <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" placeholder="Full name" value={invite.full_name} onChange={(event) => setInvite((current) => ({ ...current, full_name: event.target.value }))} />
          <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" placeholder="Email" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} />
          <select className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" value={invite.role_name} onChange={(event) => setInvite((current) => ({ ...current, role_name: event.target.value }))}>
            <option value="viewer">Viewer</option>
            <option value="creator">Creator</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950">Invite</button>
        </form>

        <DataTable
          columns={[
            { key: "name", label: "Member", render: (row) => row.user.full_name },
            { key: "email", label: "Email", render: (row) => row.user.email },
            { key: "role_name", label: "Role" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <button
                  type="button"
                  onClick={async () => {
                    await teamsApi.removeMember(user.team_id, row.user.id);
                    setMembers(await teamsApi.listMembers(user.team_id));
                  }}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-rose-300"
                >
                  Remove
                </button>
              )
            }
          ]}
          rows={members.items}
        />
        <PaginationControls pagination={members.pagination} onPageChange={async (page) => setMembers(await teamsApi.listMembers(user.team_id, { page }))} />
      </PageCard>
    </div>
  );
}
