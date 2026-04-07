import { useState, useEffect, useRef, useCallback } from "react";
import { eventConfig } from "@/config/event";
import { useAuth } from "@/context/auth";
import { api } from "@/config/api";
import { Link } from "@/router";

// ── Types ──────────────────────────────────────────
type GuestStatus = "pending" | "coming" | "declined";

interface Guest {
  _id: string;
  firstName: string;
  lastName: string;
  token: string;
  status: GuestStatus;
  numGuests: number;
  dietary: string;
  isAdmin: boolean;
  rsvpDate: string;
  createdAt: string;
  groupId: string | null;
  expectedGuests: number;
  lastLogin: string;
  lastAccess: string;
}

// ── Token generator (client-side, for form only) ───
function generateToken() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const arr = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

function formatTimestamp(iso: string): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Tabs ───────────────────────────────────────────
const tabs = [
  { id: "overview", label: "Overview" },
  { id: "guests", label: "Guest List" },
  { id: "rsvp", label: "RSVP Responses" },
  { id: "allergies", label: "Allergies" },
] as const;

type TabId = (typeof tabs)[number]["id"];

// ── Component ──────────────────────────────────────
export default function AdminPage() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [token, setToken] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newExpectedGuests, setNewExpectedGuests] = useState("1");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ guestId: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get<{ guests: Guest[]; settings: { rsvpDeadline?: string } }>("/admin/guests")
      .then((res) => {
        setGuests(res.guests);
        setRsvpDeadline(res.settings?.rsvpDeadline ?? "");
      })
      .catch((err) => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || adding) return;
    setAdding(true);
    try {
      const res = await api.post<{ guest: Guest }>("/admin/guests", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        token: token.trim() || generateToken(),
        isAdmin: newIsAdmin,
        expectedGuests: parseInt(newExpectedGuests) || 1,
      });
      setGuests((prev) => [...prev, res.guest]);
      setFirstName("");
      setLastName("");
      setToken("");
      setNewIsAdmin(false);
      setNewExpectedGuests("1");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add guest");
    } finally {
      setAdding(false);
    }
  };

  const requestDeleteGuest = useCallback((_id: string, name: string) => {
    setDeleteConfirm({ guestId: _id, name });
  }, []);

  const confirmDeleteGuest = useCallback(async () => {
    if (!deleteConfirm || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/guests/${deleteConfirm.guestId}`);
      setGuests((prev) => prev.filter((g) => g._id !== deleteConfirm.guestId));
      setDeleteConfirm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete guest");
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirm, deleting]);

  const updateGuest = useCallback(async (guestId: string, updates: Partial<Guest>) => {
    setUpdatingIds((prev) => new Set(prev).add(guestId));
    try {
      const res = await api.put<{ guest: Guest }>(`/admin/guests/${guestId}`, updates);
      setGuests((prev) => prev.map((g) => (g._id === guestId ? res.guest : g)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update guest");
    } finally {
      setUpdatingIds((prev) => { const next = new Set(prev); next.delete(guestId); return next; });
    }
  }, []);

  const setGroup = useCallback(async (guestId: string, groupId: string) => {
    setUpdatingIds((prev) => new Set(prev).add(guestId));
    try {
      const res = await api.put<{ guests: Guest[] }>(`/admin/guests/${guestId}/group`, { groupId });
      setGuests((prev) => prev.map((g) => {
        const updated = res.guests.find((u: Guest) => u._id === g._id);
        return updated ?? g;
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set group");
    } finally {
      setUpdatingIds((prev) => { const next = new Set(prev); next.delete(guestId); return next; });
    }
  }, []);

  const removeFromGroup = useCallback(async (guestId: string) => {
    setUpdatingIds((prev) => new Set(prev).add(guestId));
    try {
      const res = await api.delete<{ guest: Guest; remainingGroup: Guest[] }>(`/admin/guests/${guestId}/group`);
      setGuests((prev) => prev.map((g) => {
        if (g._id === guestId) return res.guest;
        const remaining = res.remainingGroup.find((u: Guest) => u._id === g._id);
        return remaining ?? g;
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove from group");
    } finally {
      setUpdatingIds((prev) => { const next = new Set(prev); next.delete(guestId); return next; });
    }
  }, []);

  const copyToken = (tok: string) => {
    navigator.clipboard.writeText(tok);
    setCopiedToken(tok);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const comingGuests = guests.filter((g) => g.status === "coming");
  const allergyGuests = comingGuests.filter((g) => g.dietary.trim() !== "");
  const totalAttending = comingGuests.reduce((sum, g) => sum + g.numGuests, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--base)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--base)" }}>
        <div className="text-center">
          <p className="mb-2 text-sm font-semibold" style={{ color: "#f87171" }}>Could not load guest list</p>
          <p className="text-xs" style={{ color: "var(--text-faded)" }}>{fetchError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--base)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <header className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold"
              style={{ background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#1A1A2E" }}
            >
              SS
            </div>
            <span className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
              {eventConfig.name}
            </span>
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: "var(--accent-amber-subtle)", color: "var(--accent-amber)" }}
            >
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[13px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              ← Back
            </Link>
            <button
              onClick={logout}
              className="text-[13px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 grid grid-cols-2 gap-1 rounded-xl p-1 sm:flex" style={{ backgroundColor: "var(--surface)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="rounded-lg px-5 py-2.5 text-[13px] font-semibold transition-all"
              style={{
                backgroundColor: activeTab === tab.id ? "var(--accent-amber)" : "transparent",
                color: activeTab === tab.id ? "#1A1A2E" : "var(--text-muted)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && <Overview guests={guests} comingGuests={comingGuests} allergyGuests={allergyGuests} totalAttending={totalAttending} rsvpDeadline={rsvpDeadline} setRsvpDeadline={setRsvpDeadline} />}
        {activeTab === "guests" && (
          <GuestList
            guests={guests}
            firstName={firstName}
            lastName={lastName}
            token={token}
            newIsAdmin={newIsAdmin}
            adding={adding}
            updatingIds={updatingIds}
            setFirstName={setFirstName}
            setLastName={setLastName}
            setToken={setToken}
            setNewIsAdmin={setNewIsAdmin}
            addGuest={addGuest}
            updateGuest={updateGuest}
            copyToken={copyToken}
            copiedToken={copiedToken}
            newExpectedGuests={newExpectedGuests}
            setNewExpectedGuests={setNewExpectedGuests}
            setGroup={setGroup}
            removeFromGroup={removeFromGroup}
            deleteGuest={requestDeleteGuest}
          />
        )}
        {activeTab === "rsvp" && <RsvpList comingGuests={comingGuests} />}
        {activeTab === "allergies" && <AllergyList allergyGuests={allergyGuests} />}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border p-7"
            style={{ background: "linear-gradient(145deg, var(--surface-gradient-from), var(--surface-gradient-to))", borderColor: "var(--border)" }}
          >
            <div className="mb-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>Delete guest?</div>
            <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
              Are you sure you want to delete <strong style={{ color: "var(--text-primary)" }}>{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDeleteGuest}
                disabled={deleting}
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#f87171", color: "#1A1A2E" }}
              >
                {deleting && <Spinner />}
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Group Input ────────────────────────────────────
function GroupInput({ currentGroupId, onSetGroup, onRemove }: { currentGroupId: string | null; onSetGroup: (groupId: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentGroupId || "");

  if (currentGroupId) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{currentGroupId}</span>
        <button onClick={onRemove} className="text-[11px] font-medium transition-opacity hover:opacity-70" style={{ color: "#f87171" }}>✕</button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="group-id"
          className="w-24 rounded border px-2 py-1 text-[11px] focus:outline-none"
          style={{ backgroundColor: "var(--base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) { onSetGroup(value.trim()); setEditing(false); } }}
        />
        <button onClick={() => { if (value.trim()) { onSetGroup(value.trim()); setEditing(false); } }} className="text-[11px] font-medium" style={{ color: "var(--accent-blue)" }}>Set</button>
        <button onClick={() => setEditing(false)} className="text-[11px] font-medium" style={{ color: "var(--text-faded)" }}>✕</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="rounded-full px-3 py-1 text-[11px] font-medium transition-opacity hover:opacity-80"
      style={{ backgroundColor: "var(--accent-blue-subtle)", color: "var(--accent-blue)" }}
    >
      Set Group...
    </button>
  );
}

// ── Status config ──────────────────────────────────
const statusConfig: Record<GuestStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "var(--accent-amber-subtle)", color: "var(--text-faded)" },
  coming: { label: "Coming", bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" },
  declined: { label: "Declined", bg: "rgba(239, 68, 68, 0.1)", color: "#f87171" },
};

const statusCycle: GuestStatus[] = ["pending", "coming", "declined"];

// ── Overview ───────────────────────────────────────
function Overview({
  guests, comingGuests, allergyGuests, totalAttending, rsvpDeadline, setRsvpDeadline,
}: { guests: Guest[]; comingGuests: Guest[]; allergyGuests: Guest[]; totalAttending: number; rsvpDeadline: string; setRsvpDeadline: (v: string) => void; }) {
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState(rsvpDeadline);
  const [savingDeadline, setSavingDeadline] = useState(false);

  const saveDeadline = async () => {
    if (!deadlineInput.trim() || savingDeadline) return;
    setSavingDeadline(true);
    try {
      await api.put("/admin/settings", { rsvpDeadline: deadlineInput.trim() });
      setRsvpDeadline(deadlineInput.trim());
      setEditingDeadline(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingDeadline(false);
    }
  };

  const declined = guests.filter((g) => g.status === "declined").length;
  const pending = guests.filter((g) => g.status === "pending").length;
  const stats = [
    { label: "Invited", value: guests.length, sub: `${pending} pending, ${declined} declined`, accent: false },
    { label: "Coming", value: comingGuests.length, sub: `of ${guests.length} invited`, accent: true },
    { label: "Total Guests", value: totalAttending, sub: `of ${guests.reduce((s, g) => s + (g.expectedGuests ?? 1), 0)} expected`, accent: true },
    { label: "Allergies", value: allergyGuests.length, sub: "with dietary preferences", accent: false },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border p-6" style={{ backgroundColor: "var(--surface)", borderColor: stat.accent ? "rgba(245, 158, 11, 0.2)" : "var(--border)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: "var(--text-faded)" }}>{stat.label}</div>
            <div className="mt-2 text-[40px] font-extrabold leading-none tracking-tight" style={{ color: stat.accent ? "var(--accent-amber)" : "var(--text-primary)" }}>{stat.value}</div>
            <div className="mt-1.5 text-[12px]" style={{ color: "var(--text-faded)" }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: "var(--accent-amber)" }}>RSVP Deadline</div>
        {editingDeadline ? (
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{ backgroundColor: "var(--base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <button
              onClick={saveDeadline}
              disabled={savingDeadline}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}
            >
              {savingDeadline && <Spinner />}
              {savingDeadline ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setEditingDeadline(false); setDeadlineInput(rsvpDeadline); }}
              className="text-[12px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {rsvpDeadline || "Not set"}
            </span>
            <button
              onClick={() => { setDeadlineInput(rsvpDeadline); setEditingDeadline(true); }}
              className="text-[12px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--accent-blue)" }}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {allergyGuests.length > 0 && (
        <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: "var(--accent-amber)" }}>Dietary preferences to note</div>
          <div className="space-y-3">
            {allergyGuests.map((g) => (
              <div key={g._id} className="flex items-baseline gap-3">
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{g.firstName} {g.lastName}</span>
                <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{g.dietary}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Guest List ─────────────────────────────────────
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function GuestList({ guests, firstName, lastName, token, newIsAdmin, adding, updatingIds, setFirstName, setLastName, setToken, setNewIsAdmin, addGuest, updateGuest, deleteGuest, copyToken, copiedToken, newExpectedGuests, setNewExpectedGuests, setGroup, removeFromGroup }: { guests: Guest[]; firstName: string; lastName: string; token: string; newIsAdmin: boolean; adding: boolean; updatingIds: Set<string>; setFirstName: (v: string) => void; setLastName: (v: string) => void; setToken: (v: string) => void; setNewIsAdmin: (v: boolean) => void; addGuest: (e: React.FormEvent) => void; updateGuest: (guestId: string, updates: Partial<Guest>) => void; deleteGuest: (guestId: string, name: string) => void; copyToken: (token: string) => void; copiedToken: string | null; newExpectedGuests: string; setNewExpectedGuests: (v: string) => void; setGroup: (guestId: string, groupId: string) => void; removeFromGroup: (guestId: string) => void; }) {
  const inputStyle = { backgroundColor: "var(--base)", borderColor: "var(--border)", color: "var(--text-primary)" };

  return (
    <div className="space-y-6">
      {/* ── Add guest form ── */}
      <form onSubmit={addGuest} className="space-y-4 rounded-xl border p-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faded)" }}>First Name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Anna" required className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faded)" }}>Last Name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Karlsson" required className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faded)" }}>Token</label>
            <div className="flex gap-2">
              <input type="text" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Auto" maxLength={8} className="w-full rounded-lg border px-3.5 py-2.5 font-mono text-sm focus:outline-none" style={inputStyle} />
              <button type="button" onClick={() => setToken(generateToken())} className="shrink-0 rounded-lg border px-3 py-2.5 text-[11px] font-semibold transition-opacity hover:opacity-80" style={{ borderColor: "var(--border)", color: "var(--accent-blue)" }}>Generate</button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faded)" }}>Expected</label>
            <input type="number" min="1" value={newExpectedGuests} onChange={(e) => setNewExpectedGuests(e.target.value)} className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none" style={inputStyle} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded border transition-colors"
              style={{ backgroundColor: newIsAdmin ? "var(--accent-amber)" : "var(--surface)", borderColor: newIsAdmin ? "var(--accent-amber)" : "var(--border)" }}
              onClick={() => setNewIsAdmin(!newIsAdmin)}
            >
              {newIsAdmin && <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <span className="text-[12px] font-semibold" style={{ color: "var(--text-faded)" }}>Admin</span>
          </label>
          <button type="submit" disabled={adding} className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}>
            {adding && <Spinner />}
            {adding ? "Adding..." : "+ Add"}
          </button>
        </div>
      </form>

      {/* ── Desktop table (hidden on mobile) ── */}
      <div className="hidden overflow-x-auto rounded-xl border md:block" style={{ borderColor: "var(--border)" }}>
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr style={{ backgroundColor: "var(--surface)" }}>
              <Th>Name</Th><Th>Token</Th><Th>Status</Th><Th align="right">Guests</Th><Th>Expected</Th><Th>Group</Th><Th>Last Login</Th><Th>Active</Th><Th>Admin</Th><Th>{" "}</Th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => {
              const st = statusConfig[g.status];
              const isUpdating = updatingIds.has(g._id);
              return (
                <tr key={g._id} className="border-t" style={{ borderColor: "var(--border)", opacity: isUpdating ? 0.5 : 1, transition: "opacity 0.2s" }}>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {isUpdating && <Spinner />}
                      {g.firstName} {g.lastName}
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><button onClick={() => copyToken(g.token)} className="rounded px-2 py-1 font-mono text-[12px] transition-colors hover:opacity-70" style={{ backgroundColor: "var(--accent-blue-subtle)", color: "var(--accent-blue)" }}>{copiedToken === g.token ? "✓ Copied" : g.token}</button></td>
                  <td className="px-5 py-3.5"><StatusDropdown status={g.status} onChange={(s) => updateGuest(g._id, { status: s })} /></td>
                  <td className="px-5 py-3.5 text-right"><input type="number" min="0" value={g.numGuests} onChange={(e) => updateGuest(g._id, { numGuests: parseInt(e.target.value) || 0 })} className="w-16 rounded-lg border px-2 py-1 text-right text-sm font-semibold focus:outline-none" style={inputStyle} /></td>
                  <td className="px-5 py-3.5"><input type="number" min="1" value={g.expectedGuests ?? 1} onChange={(e) => updateGuest(g._id, { expectedGuests: parseInt(e.target.value) || 1 })} className="w-16 rounded-lg border px-2 py-1 text-sm font-semibold focus:outline-none" style={inputStyle} /></td>
                  <td className="px-5 py-3.5">
                    <GroupInput currentGroupId={g.groupId} onSetGroup={(gid) => setGroup(g._id, gid)} onRemove={() => removeFromGroup(g._id)} />
                  </td>
                  <td className="px-5 py-3.5"><span className="text-[11px]" style={{ color: "var(--text-faded)" }}>{formatTimestamp(g.lastLogin)}</span></td>
                  <td className="px-5 py-3.5"><span className="text-[11px]" style={{ color: "var(--text-faded)" }}>{formatTimestamp(g.lastAccess)}</span></td>
                  <td className="px-5 py-3.5">
                    <div className="mx-auto flex h-5 w-5 cursor-pointer items-center justify-center rounded border transition-colors" style={{ backgroundColor: g.isAdmin ? "var(--accent-amber)" : "var(--surface)", borderColor: g.isAdmin ? "var(--accent-amber)" : "var(--border)" }} onClick={() => updateGuest(g._id, { isAdmin: !g.isAdmin })}>
                      {g.isAdmin && <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => deleteGuest(g._id, `${g.firstName} ${g.lastName}`)} className="text-[11px] font-medium transition-opacity hover:opacity-70" style={{ color: "#f87171" }}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards (hidden on desktop) ── */}
      <div className="space-y-3 md:hidden">
        {guests.map((g) => {
          const st = statusConfig[g.status];
          const isUpdating = updatingIds.has(g._id);
          return (
            <div
              key={g._id}
              className="rounded-xl border p-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", opacity: isUpdating ? 0.5 : 1, transition: "opacity 0.2s" }}
            >
              {/* Header: name + status */}
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {isUpdating && <Spinner />}
                    {g.firstName} {g.lastName}
                    {g.isAdmin && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: "var(--accent-amber-subtle)", color: "var(--accent-amber)" }}>Admin</span>}
                  </div>
                  <button onClick={() => copyToken(g.token)} className="mt-1 rounded px-2 py-0.5 font-mono text-[11px] transition-opacity hover:opacity-70" style={{ backgroundColor: "var(--accent-blue-subtle)", color: "var(--accent-blue)" }}>
                    {copiedToken === g.token ? "✓ Copied" : g.token}
                  </button>
                </div>
                <StatusDropdown status={g.status} onChange={(s) => updateGuest(g._id, { status: s })} />
              </div>

              {/* Stats row */}
              <div className="mb-3 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faded)" }}>Guests</div>
                  <input type="number" min="0" value={g.numGuests} onChange={(e) => updateGuest(g._id, { numGuests: parseInt(e.target.value) || 0 })} className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm font-semibold focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faded)" }}>Expected</div>
                  <input type="number" min="1" value={g.expectedGuests ?? 1} onChange={(e) => updateGuest(g._id, { expectedGuests: parseInt(e.target.value) || 1 })} className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm font-semibold focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faded)" }}>Group</div>
                  <div className="mt-1">
                    <GroupInput currentGroupId={g.groupId} onSetGroup={(gid) => setGroup(g._id, gid)} onRemove={() => removeFromGroup(g._id)} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mb-3 flex gap-4 text-[10px]" style={{ color: "var(--text-faded)" }}>
                <span>Login: {formatTimestamp(g.lastLogin)}</span>
                <span>Active: {formatTimestamp(g.lastAccess)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <label className="flex cursor-pointer items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded border transition-colors" style={{ backgroundColor: g.isAdmin ? "var(--accent-amber)" : "var(--base)", borderColor: g.isAdmin ? "var(--accent-amber)" : "var(--border)" }} onClick={() => updateGuest(g._id, { isAdmin: !g.isAdmin })}>
                    {g.isAdmin && <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-faded)" }}>Admin</span>
                </label>
                <button onClick={() => deleteGuest(g._id, `${g.firstName} ${g.lastName}`)} className="text-[12px] font-medium transition-opacity hover:opacity-70" style={{ color: "#f87171" }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RSVP List ──────────────────────────────────────
function RsvpList({ comingGuests }: { comingGuests: Guest[] }) {
  if (comingGuests.length === 0) return <EmptyState text="No one has RSVP'd yet." />;
  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-xl border md:block" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left">
          <thead><tr style={{ backgroundColor: "var(--surface)" }}><Th>Name</Th><Th align="right">Guests</Th><Th>Dietary Preferences</Th><Th>Date</Th></tr></thead>
          <tbody>
            {comingGuests.map((g) => (
              <tr key={g._id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3.5"><span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{g.firstName} {g.lastName}</span></td>
                <td className="px-5 py-3.5 text-right"><span className="text-sm font-semibold" style={{ color: "var(--accent-amber)" }}>{g.numGuests}</span></td>
                <td className="px-5 py-3.5"><span className="text-[13px]" style={{ color: g.dietary ? "var(--text-primary)" : "var(--text-faded)" }}>{g.dietary || "None"}</span></td>
                <td className="px-5 py-3.5"><span className="text-[13px]" style={{ color: "var(--text-faded)" }}>{g.rsvpDate || "—"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {comingGuests.map((g) => (
          <div key={g._id} className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{g.firstName} {g.lastName}</span>
              <span className="text-sm font-bold" style={{ color: "var(--accent-amber)" }}>{g.numGuests} guests</span>
            </div>
            {g.dietary && <div className="mb-2"><span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#f87171" }}>{g.dietary}</span></div>}
            {g.rsvpDate && <div className="text-[11px]" style={{ color: "var(--text-faded)" }}>{g.rsvpDate}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Allergy List ───────────────────────────────────
function AllergyList({ allergyGuests }: { allergyGuests: Guest[] }) {
  if (allergyGuests.length === 0) return <EmptyState text="No allergies or dietary preferences reported." />;
  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-xl border md:block" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-left">
          <thead><tr style={{ backgroundColor: "var(--surface)" }}><Th>Name</Th><Th>Dietary Preferences / Allergies</Th><Th align="right">Guests</Th></tr></thead>
          <tbody>
            {allergyGuests.map((g) => (
              <tr key={g._id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3.5"><span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{g.firstName} {g.lastName}</span></td>
                <td className="px-5 py-3.5"><span className="inline-block rounded-md px-2.5 py-1 text-[12px] font-medium" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#f87171" }}>{g.dietary}</span></td>
                <td className="px-5 py-3.5 text-right"><span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{g.numGuests}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {allergyGuests.map((g) => (
          <div key={g._id} className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{g.firstName} {g.lastName}</span>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{g.numGuests} guests</span>
            </div>
            <span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#f87171" }}>{g.dietary}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function StatusDropdown({ status, onChange }: { status: GuestStatus; onChange: (s: GuestStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const st = statusConfig[status];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(!open)} className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 overflow-hidden rounded-lg border py-1 shadow-lg" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", minWidth: 120 }}>
          {statusCycle.map((s) => {
            const cfg = statusConfig[s];
            const active = s === status;
            return (
              <button key={s} onClick={() => { onChange(s); setOpen(false); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12px] font-semibold transition-colors" style={{ color: cfg.color, backgroundColor: active ? cfg.bg : "transparent" }} onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--accent-amber-subtle)"; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shared components ──────────────────────────────
function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-[1.5px] ${align === "right" ? "text-right" : "text-left"}`} style={{ color: "var(--text-faded)" }}>{children}</th>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center justify-center rounded-xl border py-20" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}><p className="text-sm" style={{ color: "var(--text-faded)" }}>{text}</p></div>;
}
