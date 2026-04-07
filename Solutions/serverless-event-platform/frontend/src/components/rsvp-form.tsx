import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { eventConfig } from "@/config/event";
import { useAuth } from "@/context/auth";
import { api } from "@/config/api";
import { SectionReveal } from "./section-reveal";

interface GuestRsvp {
  guestId: string;
  firstName: string;
  lastName: string;
  status: string;
  numGuests: number;
  dietary: string;
  rsvpDate: string;
  expectedGuests: number;
}

interface GroupMember {
  _id: string;
  firstName: string;
  lastName: string;
  expectedGuests: number;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function RsvpForm() {
  const { displayDate, rsvpDeadline, location, dressCode, rsvp } = eventConfig;
  const { user } = useAuth();

  const [numGuests, setNumGuests] = useState("");
  const [dietary, setDietary] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expectedGuests, setExpectedGuests] = useState(1);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [familySum, setFamilySum] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "under" | "over" | "single";
    familySum: number;
    numGuests: number;
  } | null>(null);

  useEffect(() => {
    api
      .get<{ guest: GuestRsvp; groupMembers: GroupMember[]; familySum: number; rsvpDeadline: string }>("/rsvp")
      .then((res) => {
        if (res.guest.status === "coming") {
          setNumGuests(String(res.guest.numGuests));
          setDietary(res.guest.dietary);
          setSubmitted(true);
        }
        setExpectedGuests(res.guest.expectedGuests);
        setGroupMembers(res.groupMembers || []);
        setFamilySum(res.familySum ?? res.guest.expectedGuests);
        if (res.rsvpDeadline) {
          setDeadlinePassed(new Date() > new Date(res.rsvpDeadline + "T23:59:59"));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const submitRsvp = async (guests: number, groupStatus?: "coming" | "declined") => {
    setSubmitting(true);
    setError(null);
    setConfirmDialog(null);
    try {
      const body: Record<string, unknown> = {
        numGuests: guests,
        dietary: dietary.trim(),
      };
      if (groupStatus) body.groupStatus = groupStatus;
      await api.put("/rsvp", body);
      setNumGuests(String(guests));
      setSubmitted(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#F59E0B", "#F97316", "#3B82F6", "#F5F0EB"],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const n = parseInt(numGuests) || 1;

    if (groupMembers.length > 0) {
      if (n === familySum) {
        submitRsvp(n, "coming");
      } else if (n < familySum) {
        setConfirmDialog({ type: "under", familySum, numGuests: n });
      } else {
        setConfirmDialog({ type: "over", familySum, numGuests: n });
      }
    } else {
      if (n !== expectedGuests) {
        setConfirmDialog({ type: "single", familySum: expectedGuests, numGuests: n });
      } else {
        submitRsvp(n);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <SectionReveal className="mx-auto max-w-5xl px-6 py-20">
      <div className="grid items-start gap-8 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[3px]" style={{ color: "var(--accent-amber)" }}>
            {rsvp.sectionLabel}
          </div>
          <h2 className="mb-1.5 text-[28px] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {rsvp.title}
          </h2>
          <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>{rsvp.description}</p>

          <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--accent-blue-subtle)", borderColor: "rgba(59, 130, 246, 0.12)" }}>
            <div className="mb-2 text-sm font-bold" style={{ color: "var(--text-primary)" }}>{rsvp.infoTitle}</div>
            <div className="space-y-1.5 text-[13px] leading-relaxed" style={{ color: "var(--text-body)" }}>
              <div>📅 <strong style={{ color: "var(--text-primary)" }}>Date:</strong> {displayDate}</div>
              <div>📍 <strong style={{ color: "var(--text-primary)" }}>Location:</strong> {location.description}, {location.venue}, {location.city}</div>
              <div>👔 <strong style={{ color: "var(--text-primary)" }}>Dress Code:</strong> {dressCode}</div>
              <div>⏰ <strong style={{ color: "var(--text-primary)" }}>RSVP by:</strong> {rsvpDeadline}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-7" style={{ background: "linear-gradient(145deg, var(--surface-gradient-from), var(--surface-gradient-to))", borderColor: "var(--border)" }}>
          {deadlinePassed ? (
            <div className="py-8 text-center">
              <div className="mb-4 text-5xl">⏰</div>
              <div className="mb-2 text-lg font-bold" style={{ color: "var(--text-primary)" }}>RSVP is closed</div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>The RSVP deadline has passed.</div>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {user?.firstName} {user?.lastName}
                  {groupMembers.length > 0 && (
                    <span style={{ color: "var(--text-muted)" }}> & {groupMembers.map(m => `${m.firstName} ${m.lastName}`).join(" & ")}</span>
                  )}
                </div>
                <div className="text-xs" style={{ color: "var(--text-faded)" }}>
                  {submitted ? "You've already responded. Update below if you'd like to change." : `Expected guests: ${familySum}`}
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-lg px-4 py-2.5 text-[13px] font-medium" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#f87171" }}>
                  {error}
                </div>
              )}

              {confirmDialog ? (
                <ConfirmDialog
                  dialog={confirmDialog}
                  groupMembers={groupMembers}
                  submitting={submitting}
                  onConfirmPartnerJoins={() => submitRsvp(confirmDialog.familySum, "coming")}
                  onConfirmAlone={() => submitRsvp(confirmDialog.numGuests, "declined")}
                  onConfirmOver={() => submitRsvp(confirmDialog.numGuests, "coming")}
                  onConfirmSingle={() => submitRsvp(confirmDialog.numGuests)}
                  onCancel={() => setConfirmDialog(null)}
                />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      {rsvp.fields.guests.label}
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder={rsvp.fields.guests.placeholder}
                      value={numGuests}
                      onChange={(e) => setNumGuests(e.target.value)}
                      required
                      className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      {rsvp.fields.dietary.label}
                    </label>
                    <input
                      type="text"
                      placeholder={rsvp.fields.dietary.placeholder}
                      value={dietary}
                      onChange={(e) => setDietary(e.target.value)}
                      className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}
                  >
                    {submitting && <Spinner />}
                    {submitting ? "Submitting..." : submitted ? "UPDATE RSVP" : rsvp.submitLabel}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </SectionReveal>
  );
}

function ConfirmDialog({
  dialog,
  groupMembers,
  submitting,
  onConfirmPartnerJoins,
  onConfirmAlone,
  onConfirmOver,
  onConfirmSingle,
  onCancel,
}: {
  dialog: { type: "under" | "over" | "single"; familySum: number; numGuests: number };
  groupMembers: GroupMember[];
  submitting: boolean;
  onConfirmPartnerJoins: () => void;
  onConfirmAlone: () => void;
  onConfirmOver: () => void;
  onConfirmSingle: () => void;
  onCancel: () => void;
}) {
  const memberNames = groupMembers.map(m => m.firstName).join(" & ");
  const areOrIs = groupMembers.length > 1 ? "are" : "is";

  return (
    <div className="space-y-4 py-4">
      {dialog.type === "under" && (
        <>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            You are registered for <strong>{dialog.familySum}</strong> people but you're signing up <strong>{dialog.numGuests}</strong>. Isn't {memberNames} coming?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onConfirmPartnerJoins}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}
            >
              {submitting && <Spinner />}
              {memberNames} {areOrIs} also coming
            </button>
            <button
              onClick={onConfirmAlone}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              {submitting && <Spinner />}
              Just me
            </button>
            <button
              onClick={onCancel}
              className="py-2 text-[12px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--text-faded)" }}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {dialog.type === "over" && (
        <>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            You are registered for <strong>{dialog.familySum}</strong> people but you're signing up <strong>{dialog.numGuests}</strong>. Is that correct?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onConfirmOver}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}
            >
              {submitting && <Spinner />}
              Yes, that's correct
            </button>
            <button
              onClick={onCancel}
              className="rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Change
            </button>
          </div>
        </>
      )}

      {dialog.type === "single" && (
        <>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Expected number is <strong>{dialog.familySum}</strong> but you're signing up <strong>{dialog.numGuests}</strong>. Is that correct?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onConfirmSingle}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}
            >
              {submitting && <Spinner />}
              Yes, that's correct
            </button>
            <button
              onClick={onCancel}
              className="rounded-xl border py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Change
            </button>
          </div>
        </>
      )}
    </div>
  );
}
