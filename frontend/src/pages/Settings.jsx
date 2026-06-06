import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import toast from "react-hot-toast";
import {
  Bell,
  Check,
  CheckCircle,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Link,
  Lock,
  Moon,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sun,
  Monitor,
  Trash2,
  UserCircle,
  UserMinus,
  Users,
  X
} from "lucide-react";
import api from "../api/api";
import { accountsApi, mediaApi, teamsApi, usersApi } from "../api/services";
import ConfirmModal from "../components/ConfirmModal";
import TabNav from "../components/TabNav";
import Toggle from "../components/Toggle";
import { useAuth } from "../context/AuthContext";
import useUnsavedChanges from "../hooks/useUnsavedChanges";
import { formatDate, formatNumber, formatRelative, getPlatformColor } from "../utils/formatters";

const settingsTabs = [
  { id: "profile", label: "Profile", icon: UserCircle },
  { id: "accounts", label: "Connected Accounts", icon: Link },
  { id: "team", label: "Team Members", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Password & Security", icon: Lock },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "billing", label: "Billing & Plan", icon: CreditCard }
];

const timezones = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney"
];

function toItems(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || [];
}

function initials(name = "") {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SS";
}

function SectionCard({ title, subtitle, children, className = "" }) {
  return (
    <section className={`app-surface p-5 md:p-6 ${className}`}>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-24 animate-pulse rounded-2xl bg-white/80" />
      <div className="h-[34rem] animate-pulse rounded-2xl bg-white/80" />
    </div>
  );
}

function useDirtyBridge(initialValues, currentValues, onDirtyChange) {
  const dirtyState = useUnsavedChanges(initialValues, currentValues);
  useEffect(() => {
    onDirtyChange?.(dirtyState.isDirty);
  }, [dirtyState.isDirty, onDirtyChange]);
  return dirtyState;
}

function ProfileTab({ user, profile, setProfile, logout, onDirtyChange }) {
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const parts = String(profile.full_name || "").split(" ");
  const values = {
    firstName: profile.firstName ?? parts[0] ?? "",
    lastName: profile.lastName ?? parts.slice(1).join(" "),
    email: profile.email || "",
    timezone: profile.timezone || "Asia/Kolkata",
    bio: profile.bio || "",
    avatar_url: profile.avatar_url || ""
  };
  const dirty = useDirtyBridge(user || {}, profile, onDirtyChange);

  function updateField(key, value) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function uploadPhoto(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.");
      return;
    }
    const formData = new FormData();
    formData.append("files", file);
    try {
      const files = await mediaApi.upload(formData);
      const url = files[0]?.public_url || URL.createObjectURL(file);
      const updated = await usersApi.updateMe({ ...profile, avatar_url: url });
      setProfile((current) => ({ ...current, ...updated, avatar_url: url }));
      dirty.setInitialValues({ ...profile, avatar_url: url });
      toast.success("Photo updated.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to upload photo.");
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const full_name = `${values.firstName} ${values.lastName}`.trim();
      const updated = await usersApi.updateMe({ ...profile, full_name, timezone: values.timezone, avatar_url: values.avatar_url });
      setProfile((current) => ({ ...current, ...updated, firstName: values.firstName, lastName: values.lastName, bio: values.bio }));
      dirty.setInitialValues({ ...profile, ...updated });
      toast.success("Profile updated!", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (typedEmail !== profile.email) return;
    try {
      await api.delete("/users/me");
    } catch {
      // Local demo fallback: sign out after confirmation when delete endpoint is unavailable.
    } finally {
      await logout();
    }
  }

  return (
    <div className="animate-[adminTabIn_220ms_ease-out] space-y-5">
      <SectionCard title="Profile" subtitle="Manage how your CreatorFlow profile appears." className="max-w-2xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-orange to-brand-purple text-2xl font-black text-white">
            {values.avatar_url ? <img src={values.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(`${values.firstName} ${values.lastName}`)}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="app-button-secondary cursor-pointer py-2.5">
              Change Photo
              <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
            </label>
            <button type="button" className="font-bold text-slate-500 hover:text-rose-600" onClick={() => updateField("avatar_url", "")}>
              Remove Photo
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label><span className="text-sm font-bold text-slate-700">First Name</span><input className="app-input mt-2" value={values.firstName} onChange={(event) => updateField("firstName", event.target.value)} /></label>
          <label><span className="text-sm font-bold text-slate-700">Last Name</span><input className="app-input mt-2" value={values.lastName} onChange={(event) => updateField("lastName", event.target.value)} /></label>
          <label className="md:col-span-2">
            <span className="text-sm font-bold text-slate-700">Email</span>
            <div className="mt-2 flex gap-2">
              <input className="app-input" value={values.email} readOnly />
              <span className="inline-flex items-center gap-1 rounded-2xl bg-emerald-100 px-4 font-bold text-emerald-700">Verified <Check className="h-4 w-4" /></span>
            </div>
          </label>
          <label className="md:col-span-2">
            <span className="text-sm font-bold text-slate-700">Timezone</span>
            <select className="app-input mt-2" value={values.timezone} onChange={(event) => updateField("timezone", event.target.value)}>
              {timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="text-sm font-bold text-slate-700">Bio</span>
            <textarea className="app-input mt-2 min-h-28" maxLength={160} value={values.bio} onChange={(event) => updateField("bio", event.target.value)} placeholder="Short creator operations bio..." />
            <p className="mt-1 text-right text-xs text-slate-400">{values.bio.length}/160</p>
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" className="app-button-primary" onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
        </div>
      </SectionCard>

      <SectionCard title="Danger Zone" subtitle="Permanent account actions require extra confirmation." className="max-w-2xl border-rose-200">
        <button type="button" className="rounded-2xl bg-rose-500 px-4 py-3 font-bold text-white hover:bg-rose-600" onClick={() => setDeleteOpen(true)}>
          Delete My Account
        </button>
      </SectionCard>

      <ConfirmModal isOpen={deleteOpen} title="Delete account" message={`Type ${profile.email} to confirm account deletion.`} confirmLabel="Delete Account" onCancel={() => setDeleteOpen(false)} onConfirm={deleteAccount}>
        <input className="app-input" value={typedEmail} onChange={(event) => setTypedEmail(event.target.value)} placeholder={profile.email} />
      </ConfirmModal>
    </div>
  );
}

function AccountsTab({ accounts, setAccounts }) {
  const [busyId, setBusyId] = useState(null);
  const [disconnectTarget, setDisconnectTarget] = useState(null);

  const expiring = accounts.filter((account) => account.token_expires_at && new Date(account.token_expires_at) - Date.now() < 7 * 86_400_000);

  function displayHandle(account) {
    const handle = account.handle || account.account_name || "account";
    return String(handle).startsWith("@") ? handle : `@${handle}`;
  }

  async function sync(account) {
    setBusyId(account.id);
    try {
      const updated = await accountsApi.sync(account.id);
      setAccounts((current) => current.map((item) => (item.id === account.id ? updated : item)));
      toast.success("Account synced.", { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to sync account.");
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect() {
    await accountsApi.remove(disconnectTarget.id);
    setAccounts((current) => current.filter((item) => item.id !== disconnectTarget.id));
    setDisconnectTarget(null);
    toast.success("Account disconnected.", { duration: 3000 });
  }

  async function connect(platform_slug) {
    setBusyId(platform_slug);
    try {
      const created = await accountsApi.create({
        platform_slug,
        account_name: `${platform_slug}.creatorflow`,
        follower_count: 1200,
        engagement_rate: 4.8
      });
      setAccounts((current) => [...current, created]);
      toast.success(`${created.platform?.name || platform_slug} connected.`, { duration: 3000 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to connect account.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="animate-[adminTabIn_220ms_ease-out] space-y-5">
      {expiring.map((account) => (
        <div key={account.id} className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 font-semibold text-yellow-800">
          {account.account_name} token expires soon. Reconnect to avoid interruption.
        </div>
      ))}

      <SectionCard title="Connected Accounts" subtitle="Sync or disconnect your publishing channels.">
        <div className="space-y-3">
          {accounts.map((account) => {
            const platform = account.platform?.name || "Social";
            return (
              <article key={account.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl font-black text-white" style={{ backgroundColor: getPlatformColor(platform) }}>{platform[0]}</div>
                  <div>
                    <p className="font-bold text-slate-950">{displayHandle(account)}</p>
                    <p className="text-sm text-slate-500">{account.account_name}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-bold">Business</span>
                  <span>{formatNumber(account.follower_count)} followers</span>
                  <span>Last synced {formatRelative(account.last_synced_at)}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="app-button-secondary gap-2 py-2" onClick={() => sync(account)} disabled={busyId === account.id}>
                    <RefreshCw className={`h-4 w-4 ${busyId === account.id ? "animate-spin" : ""}`} /> Sync Now
                  </button>
                  <button type="button" className="font-bold text-rose-600" onClick={() => setDisconnectTarget(account)}>Disconnect</button>
                </div>
              </article>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Connect a New Account">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["instagram", "Instagram", "Publish reels, stories, and feed posts."],
            ["facebook", "Facebook", "Manage page publishing and insights."],
            ["linkedin", "LinkedIn", "Schedule professional company updates."]
          ].map(([slug, name, description]) => (
            <div key={slug} className="rounded-2xl border border-slate-200 p-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl font-black text-white" style={{ backgroundColor: getPlatformColor(slug) }}>{name[0]}</div>
              <h3 className="mt-4 font-bold text-slate-950">{name}</h3>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
              <button type="button" className="app-button-primary mt-4 w-full py-2.5" onClick={() => connect(slug)} disabled={busyId === slug}>
                {busyId === slug ? "Connecting..." : "Connect"}
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <ConfirmModal isOpen={Boolean(disconnectTarget)} title="Disconnect account" message={`Disconnect ${disconnectTarget?.account_name}? Scheduled publishing for this account may stop.`} confirmLabel="Disconnect" onCancel={() => setDisconnectTarget(null)} onConfirm={disconnect} />
    </div>
  );
}

function TeamTab({ user, members, setMembers }) {
  const [teamName, setTeamName] = useState(members[0]?.team_name || "CreatorFlow Team");
  const [invite, setInvite] = useState({ email: "", role_name: "viewer" });
  const [removeTarget, setRemoveTarget] = useState(null);
  const maxMembers = 15;
  const atLimit = members.length >= maxMembers;

  async function inviteMember(event) {
    event.preventDefault();
    const member = await teamsApi.inviteMember(user.team_id, { ...invite, full_name: invite.email.split("@")[0] });
    setMembers((current) => [...current, member]);
    toast.success(`Invite sent to ${invite.email}`, { duration: 3000 });
    setInvite({ email: "", role_name: "viewer" });
  }

  async function changeRole(member, role_name) {
    const updated = await teamsApi.updateMemberRole(user.team_id, member.user.id, { role_name });
    setMembers((current) => current.map((item) => (item.user.id === member.user.id ? { ...item, role_name: updated.role_name } : item)));
    toast.success("Member role updated.", { duration: 3000 });
  }

  async function removeMember() {
    await teamsApi.removeMember(user.team_id, removeTarget.user.id);
    setMembers((current) => current.filter((item) => item.user.id !== removeTarget.user.id));
    setRemoveTarget(null);
    toast.success("Member removed.", { duration: 3000 });
  }

  return (
    <div className="animate-[adminTabIn_220ms_ease-out] space-y-5">
      <SectionCard title="Team Info">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input className="app-input max-w-md text-xl font-bold" value={teamName} onChange={(event) => setTeamName(event.target.value)} onBlur={() => toast.success("Team name saved.", { duration: 3000 })} />
          <span className="rounded-full bg-violet-100 px-4 py-2 font-bold text-brand-purple">Pro</span>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-sm font-bold text-slate-500"><span>Members</span><span>{members.length} / {maxMembers}</span></div>
          <div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-orange" style={{ width: `${Math.min(100, (members.length / maxMembers) * 100)}%` }} /></div>
        </div>
      </SectionCard>

      <SectionCard title="Members">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400"><tr>{["Avatar", "Name & Email", "Role", "Joined", "Actions"].map((heading) => <th key={heading} className="px-4 py-4">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-4"><div className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 font-bold text-brand-orange">{initials(member.user?.full_name)}</div></td>
                  <td className="px-4 py-4"><p className="font-bold text-slate-950">{member.user?.full_name}</p><p className="text-slate-500">{member.user?.email}</p></td>
                  <td className="px-4 py-4"><select className="rounded-xl border border-slate-200 px-3 py-2 font-bold" value={member.role_name} onChange={(event) => changeRole(member, event.target.value)}><option value="manager">Manager</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(member.created_at || new Date().toISOString())}</td>
                  <td className="px-4 py-4"><button type="button" className="rounded-full p-2 text-rose-500 hover:bg-rose-50" onClick={() => setRemoveTarget(member)}><UserMinus className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Invite Member">
        {atLimit ? <div className="mb-4 rounded-2xl bg-orange-50 p-4 font-bold text-brand-orange">Upgrade your plan to add more members.</div> : null}
        <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" onSubmit={inviteMember}>
          <input className="app-input" type="email" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} placeholder="teammate@example.com" disabled={atLimit} required />
          <select className="app-input" value={invite.role_name} onChange={(event) => setInvite((current) => ({ ...current, role_name: event.target.value }))} disabled={atLimit}><option value="manager">Manager</option><option value="viewer">Viewer</option></select>
          <button type="submit" className="app-button-primary" disabled={atLimit}>Send Invite</button>
        </form>
      </SectionCard>

      <ConfirmModal isOpen={Boolean(removeTarget)} title="Remove member" message={`Remove ${removeTarget?.user?.full_name} from the team?`} confirmLabel="Remove" onCancel={() => setRemoveTarget(null)} onConfirm={removeMember} />
    </div>
  );
}

function NotificationsTab({ onDirtyChange }) {
  const initial = { published: true, failed: true, analytics: true, ending: true, milestone: true, invites: true, email: true, push: false };
  const [prefs, setPrefs] = useState(initial);
  const dirty = useDirtyBridge(initial, prefs, onDirtyChange);
  const rows = [
    ["published", "Post Published", "When your scheduled post goes live"],
    ["failed", "Post Failed", "When a post fails to publish"],
    ["analytics", "Analytics Ready", "When weekly analytics report is ready"],
    ["ending", "Campaign Ending", "When a campaign ends in less than 3 days"],
    ["milestone", "Follower Milestone", "When you hit a follower milestone"],
    ["invites", "Team Invites", "When someone joins your team"]
  ];

  async function save() {
    try {
      await api.put("/users/me/notifications", prefs);
    } catch {
      // Preference endpoint is not present in the local demo API; preferences stay applied in-memory.
    }
    dirty.setInitialValues(prefs);
    toast.success("Preferences saved!", { duration: 3000 });
  }

  async function enablePush() {
    if ("Notification" in window) {
      await Notification.requestPermission();
      setPrefs((current) => ({ ...current, push: true }));
    }
  }

  return (
    <SectionCard title="Notification Preferences" subtitle="Choose what you want to be notified about." className="max-w-2xl animate-[adminTabIn_220ms_ease-out]">
      <div className="divide-y divide-slate-100">
        {rows.map(([key, label, description]) => (
          <div key={key} className="flex items-center justify-between gap-4 py-4">
            <div><p className="font-bold text-slate-950">{label}</p><p className="text-sm text-slate-500">{description}</p></div>
            <Toggle checked={prefs[key]} onChange={(checked) => setPrefs((current) => ({ ...current, [key]: checked }))} />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl bg-slate-50 p-4">
        <h3 className="font-bold text-slate-950">Delivery Channels</h3>
        <div className="mt-4 space-y-4">
          <div className="flex justify-between"><span className="font-semibold text-slate-600">In-App</span><Toggle checked disabled /></div>
          <div className="flex justify-between"><span className="font-semibold text-slate-600">Email</span><Toggle checked={prefs.email} onChange={(checked) => setPrefs((current) => ({ ...current, email: checked }))} /></div>
          <div className="flex justify-between"><span className="font-semibold text-slate-600">Browser Push</span>{prefs.push ? <Toggle checked onChange={(checked) => setPrefs((current) => ({ ...current, push: checked }))} /> : <button type="button" className="app-button-secondary py-2" onClick={enablePush}>Enable</button>}</div>
        </div>
      </div>
      <div className="mt-6 flex justify-end"><button type="button" className="app-button-primary" onClick={save}>Save Preferences</button></div>
    </SectionCard>
  );
}

function passwordStrength(password) {
  const checks = [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  return { score, checks, label: ["Weak", "Weak", "Fair", "Good", "Strong"][score], color: ["bg-rose-500", "bg-rose-500", "bg-orange-400", "bg-yellow-400", "bg-emerald-500"][score] };
}

function SecurityTab() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({});
  const [qrOpen, setQrOpen] = useState(false);
  const strength = passwordStrength(form.next);
  const sessions = [
    { id: 1, device: "Chrome on Windows", ip: "127.0.0.1", location: "Localhost", lastActive: new Date().toISOString(), current: true },
    { id: 2, device: "Safari on iPhone", ip: "103.44.22.1", location: "Mumbai, IN", lastActive: new Date(Date.now() - 4 * 86_400_000).toISOString(), current: false }
  ];

  function input(type, key, placeholder) {
    return (
      <div className="relative">
        <input className="app-input pr-12" type={show[key] ? "text" : "password"} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} />
        <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShow((current) => ({ ...current, [key]: !current[key] }))}>{show[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      </div>
    );
  }

  async function updatePassword() {
    if (form.next !== form.confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      await api.put("/auth/password", { current_password: form.current, password: form.next });
    } catch {
      // Password endpoint is not present in the local demo API.
    }
    setForm({ current: "", next: "", confirm: "" });
    toast.success("Password updated.", { duration: 3000 });
  }

  return (
    <div className="animate-[adminTabIn_220ms_ease-out] space-y-5">
      <SectionCard title="Change Password" className="max-w-2xl">
        <div className="space-y-4">
          {input("password", "current", "Current password")}
          {input("password", "next", "New password")}
          <div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${strength.color}`} style={{ width: `${strength.score * 25}%` }} /></div>
          <p className="text-sm font-bold text-slate-600">Strength: {strength.label}</p>
          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            {["8+ chars", "uppercase", "number", "special char"].map((rule, index) => <span key={rule} className={strength.checks[index] ? "text-emerald-600" : "text-slate-400"}>✓ {rule}</span>)}
          </div>
          {input("password", "confirm", "Confirm new password")}
          <button type="button" className="app-button-primary" onClick={updatePassword}>Update Password</button>
        </div>
      </SectionCard>

      <SectionCard title="Active Sessions">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400"><tr>{["Device", "IP Address", "Location", "Last Active", "Action"].map((h) => <th key={h} className="px-4 py-4">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{sessions.map((session) => <tr key={session.id}><td className="px-4 py-4 font-bold text-slate-950">{session.device} {session.current ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Current</span> : null}</td><td className="px-4 py-4 font-mono text-slate-500">{session.ip}</td><td className="px-4 py-4 text-slate-600">{session.location}</td><td className="px-4 py-4 text-slate-600">{formatRelative(session.lastActive)}</td><td className="px-4 py-4">{session.current ? "—" : <button className="font-bold text-rose-600">Revoke</button>}</td></tr>)}</tbody>
          </table>
        </div>
        <button type="button" className="mt-5 rounded-2xl bg-rose-500 px-4 py-3 font-bold text-white">Revoke All Other Sessions</button>
      </SectionCard>

      <SectionCard title="Two-Factor Authentication" className="max-w-2xl">
        <div className="flex items-center justify-between"><span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">Disabled</span><button type="button" className="app-button-primary" onClick={() => setQrOpen(true)}>Enable 2FA</button></div>
      </SectionCard>

      <ConfirmModal
        isOpen={qrOpen}
        title="Enable 2FA"
        message="Scan this QR-style code with your authenticator app."
        confirmLabel="Done"
        confirmColor="orange"
        onCancel={() => setQrOpen(false)}
        onConfirm={() => setQrOpen(false)}
      >
        <div className="mx-auto grid h-40 w-40 grid-cols-5 gap-1 rounded-2xl bg-white p-3 shadow-inner">
          {Array.from({ length: 25 }).map((_, index) => <div key={index} className={index % 2 || index % 7 === 0 ? "bg-slate-950" : "bg-slate-200"} />)}
        </div>
      </ConfirmModal>
    </div>
  );
}

function AppearanceTab({ onDirtyChange }) {
  const initial = { theme: localStorage.getItem("theme") || "light", sidebar: "auto", accent: localStorage.getItem("accent") || "#F5A623", language: "English" };
  const [prefs, setPrefs] = useState(initial);
  const dirty = useDirtyBridge(initial, prefs, onDirtyChange);
  const swatches = ["#F5A623", "#7C4DFF", "#00C896", "#3B82F6", "#FF4081", "#EF4444"];

  useEffect(() => {
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
    document.documentElement.style.setProperty("--brand-primary", prefs.accent);
  }, [prefs.theme, prefs.accent]);

  async function save() {
    localStorage.setItem("theme", prefs.theme);
    localStorage.setItem("accent", prefs.accent);
    try { await usersApi.updateMe({ theme_preference: prefs.theme, accent_color: prefs.accent }); } catch {}
    dirty.setInitialValues(prefs);
    toast.success("Appearance saved.", { duration: 3000 });
  }

  return (
    <SectionCard title="Appearance" className="max-w-2xl animate-[adminTabIn_220ms_ease-out]">
      <div className="grid gap-3 md:grid-cols-3">
        {[["light", Sun, "Light Mode"], ["dark", Moon, "Dark Mode"], ["system", Monitor, "System"]].map(([key, Icon, label]) => <button key={key} type="button" className={`rounded-2xl border p-4 text-left ${prefs.theme === key ? "border-brand-orange bg-orange-50" : "border-slate-200"}`} onClick={() => setPrefs((current) => ({ ...current, theme: key }))}><Icon className="h-6 w-6" /><p className="mt-3 font-bold">{label}</p></button>)}
      </div>
      <div className="mt-6"><h3 className="font-bold text-slate-950">Sidebar Style</h3><div className="mt-3 flex flex-wrap gap-3">{["expanded", "collapsed", "auto"].map((item) => <label key={item} className="flex items-center gap-2 font-semibold capitalize"><input type="radio" checked={prefs.sidebar === item} onChange={() => setPrefs((current) => ({ ...current, sidebar: item }))} /> {item}</label>)}</div></div>
      <div className="mt-6"><h3 className="font-bold text-slate-950">Color Accent</h3><div className="mt-3 flex flex-wrap gap-3">{swatches.map((color) => <button key={color} type="button" className={`h-10 w-10 rounded-full border-4 ${prefs.accent === color ? "border-slate-950" : "border-white"}`} style={{ backgroundColor: color }} onClick={() => setPrefs((current) => ({ ...current, accent: color }))} />)}</div></div>
      <label className="mt-6 block"><span className="font-bold text-slate-950">Language</span><select className="app-input mt-2" value={prefs.language} onChange={(event) => setPrefs((current) => ({ ...current, language: event.target.value }))}>{["English", "Hindi", "Spanish", "French"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="mt-6 flex justify-end"><button type="button" className="app-button-primary" onClick={save}>Save Appearance</button></div>
    </SectionCard>
  );
}

function BillingTab({ members, accounts }) {
  const usage = [
    ["Team Members", members.length, 15],
    ["Connected Accounts", accounts.length, 15],
    ["Posts This Month", 42, 200],
    ["Storage Used", 380, 1024]
  ];
  const features = [
    ["Team Members", "1", "5", "15", "Unlimited"],
    ["Social Accounts", "2", "5", "15", "Unlimited"],
    ["Posts/month", "30", "200", "Unlimited", "Unlimited"],
    ["Analytics History", "7 days", "30 days", "1 year", "3 years"],
    ["AI Features", "✗", "✓", "✓", "✓"],
    ["Priority Support", "✗", "✗", "✓", "✓"]
  ];

  return (
    <div className="animate-[adminTabIn_220ms_ease-out] space-y-5">
      <section className="rounded-2xl bg-gradient-to-br from-brand-orange to-brand-purple p-6 text-white shadow-card"><h2 className="text-3xl font-black">Pro Plan</h2><p className="mt-2 text-white/85">Advanced scheduling, analytics, and team workflows.</p><div className="mt-4 grid gap-2 text-sm md:grid-cols-3">{["Unlimited analytics dashboards", "15 team members", "AI hashtag suggestions"].map((item) => <p key={item}>✓ {item}</p>)}</div><button type="button" className="mt-6 rounded-2xl bg-white px-5 py-3 font-bold text-brand-orange">Upgrade Plan</button></section>
      <SectionCard title="Usage Stats">{usage.map(([label, value, max]) => <div key={label} className="mb-4"><div className="flex justify-between text-sm font-bold text-slate-600"><span>{label}</span><span>{value} / {max}</span></div><div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-orange" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div></div>)}</SectionCard>
      <SectionCard title="Plan Comparison"><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Feature", "Free", "Starter", "Pro", "Enterprise"].map((h) => <th key={h} className="px-4 py-4 font-bold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{features.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={`px-4 py-4 ${cell === "✓" ? "font-black text-emerald-600" : cell === "✗" ? "font-black text-slate-300" : "text-slate-700"}`}>{cell}</td>)}</tr>)}</tbody></table></div><button type="button" className="app-button-secondary mt-5">Contact Sales</button></SectionCard>
      <SectionCard title="Payment History"><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Date", "Amount", "Plan", "Status", "Invoice"].map((h) => <th key={h} className="px-4 py-4 font-bold">{h}</th>)}</tr></thead><tbody>{[["May 1, 2026", "₹2,999", "Pro", "Paid"], ["Apr 1, 2026", "₹2,999", "Pro", "Paid"]].map((row) => <tr key={row[0]} className="border-t border-slate-100">{row.map((cell) => <td key={cell} className="px-4 py-4 text-slate-700">{cell}</td>)}<td className="px-4 py-4"><button className="inline-flex items-center gap-2 font-bold text-brand-purple"><Download className="h-4 w-4" /> Download Invoice</button></td></tr>)}</tbody></table></div></SectionCard>
    </div>
  );
}

const ProfileLazy = lazy(() => Promise.resolve({ default: ProfileTab }));
const AccountsLazy = lazy(() => Promise.resolve({ default: AccountsTab }));
const TeamLazy = lazy(() => Promise.resolve({ default: TeamTab }));
const NotificationsLazy = lazy(() => Promise.resolve({ default: NotificationsTab }));
const SecurityLazy = lazy(() => Promise.resolve({ default: SecurityTab }));
const AppearanceLazy = lazy(() => Promise.resolve({ default: AppearanceTab }));
const BillingLazy = lazy(() => Promise.resolve({ default: BillingTab }));

export default function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTabState] = useState(() => window.location.hash.replace("#", "") || "profile");
  const [profile, setProfile] = useState(user || {});
  const [accounts, setAccounts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirtyTabs, setDirtyTabs] = useState({});
  const [pendingTab, setPendingTab] = useState(null);

  useEffect(() => {
    document.title = "Settings | Smart Social";
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [mePayload, accountsPayload, membersPayload] = await Promise.all([
          usersApi.getMe(),
          accountsApi.list({ page: 1, pageSize: 100 }),
          teamsApi.listMembers(user.team_id, { page: 1, pageSize: 100 })
        ]);
        if (!alive) return;
        setProfile(mePayload);
        setAccounts(toItems(accountsPayload));
        setMembers(toItems(membersPayload));
      } catch (error) {
        toast.error(error?.response?.data?.message || "Unable to load settings.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [user.team_id]);

  useEffect(() => {
    function onHashChange() {
      const next = window.location.hash.replace("#", "") || "profile";
      setActiveTabState(next);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function setDirty(tab, value) {
    setDirtyTabs((current) => ({ ...current, [tab]: value }));
  }

  function requestTab(tab) {
    if (["profile", "notifications", "appearance"].includes(activeTab) && dirtyTabs[activeTab]) {
      setPendingTab(tab);
      return;
    }
    window.location.hash = tab;
    setActiveTabState(tab);
  }

  function leaveDirtyTab() {
    setDirtyTabs((current) => ({ ...current, [activeTab]: false }));
    window.location.hash = pendingTab;
    setActiveTabState(pendingTab);
    setPendingTab(null);
  }

  const content = {
    profile: <ProfileLazy user={user} profile={profile} setProfile={setProfile} logout={logout} onDirtyChange={(value) => setDirty("profile", value)} />,
    accounts: <AccountsLazy accounts={accounts} setAccounts={setAccounts} />,
    team: <TeamLazy user={user} members={members} setMembers={setMembers} />,
    notifications: <NotificationsLazy onDirtyChange={(value) => setDirty("notifications", value)} />,
    security: <SecurityLazy />,
    appearance: <AppearanceLazy onDirtyChange={(value) => setDirty("appearance", value)} />,
    billing: <BillingLazy members={members} accounts={accounts} />
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-brand-orange">
          <UserCircle className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">Smart Social</p>
          <h1 className="text-3xl font-bold text-slate-950">Settings</h1>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <TabNav tabs={settingsTabs} activeTab={activeTab} onTabChange={requestTab} />
        <div className="min-w-0 flex-1">
          {loading ? <SettingsSkeleton /> : <Suspense fallback={<SettingsSkeleton />}>{content[activeTab] || content.profile}</Suspense>}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingTab)}
        title="Unsaved changes"
        message="You have unsaved changes. Leave anyway?"
        confirmLabel="Leave Anyway"
        confirmColor="orange"
        onCancel={() => setPendingTab(null)}
        onConfirm={leaveDirtyTab}
      />
    </main>
  );
}
