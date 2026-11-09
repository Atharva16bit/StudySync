import { useState } from "react";
import { api, formatDate, useLoad } from "./api.js";

const hourMs = 60 * 60 * 1000;

function FutureSlots() {
  const firstHour = Math.floor(Date.now() / hourMs) + 1;

  return Array.from({ length: 72 }, (_, index) => {
    const startsAt = new Date((firstHour + index) * hourMs).toISOString();

    return (
      <option key={startsAt} value={startsAt}>
        {formatDate(startsAt)}
      </option>
    );
  });
}

function TaskForm({ children, label, onSubmit }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");

    try {
      await onSubmit(data);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} aria-busy={busy}>
      <fieldset className="stack" disabled={busy}>
        {children}
        <button type="submit">{busy ? "Saving…" : label}</button>
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function TutorProfileEditor({ profile, slots, onChange }) {
  async function saveProfile(data) {
    const subjects = String(data.get("subjects"))
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean);

    const bio = String(data.get("bio")).trim();
    const hourlyRatePaise = Math.round(Number(data.get("rate")) * 100);

    await api("/tutors/me", {
      method: "PUT",
      body: { subjects, bio, hourlyRatePaise },
    });

    onChange();
  }

  async function addSlot(data) {
    await api("/tutors/me/slots", {
      method: "POST",
      body: { startsAt: data.get("startsAt") },
    });

    onChange();
  }

  return (
    <div className="stack">
      <div className="row spread">
        <h3>Your tutor profile</h3>
        <span className="badge" role="status">
          {profile?.verificationStatus ?? "Draft"}
        </span>
      </div>

      <p className="muted">
        An admin reviews new profiles and edits before they appear in the
        directory.
      </p>

      <TaskForm label="Submit profile for review" onSubmit={saveProfile}>
        <label>
          Subjects, separated by commas
          <input
            name="subjects"
            defaultValue={profile?.subjects.join(", ") ?? ""}
            placeholder="DBMS, SQL"
            maxLength={620}
            required
          />
        </label>

        <label>
          What can you help students learn?
          <textarea
            name="bio"
            defaultValue={profile?.bio ?? ""}
            maxLength={1000}
            rows={3}
            required
          />
        </label>

        <label>
          Hourly rate in rupees
          <input
            name="rate"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={profile?.hourlyRate ?? ""}
            required
          />
        </label>
      </TaskForm>

      {profile && (
        <section className="stack">
          <h3>Your availability</h3>
          <p className="muted">
            Each session lasts one hour. Times are shown in your local timezone.
          </p>

          <TaskForm label="Add availability" onSubmit={addSlot}>
            <label>
              Session start
              <select name="startsAt" defaultValue="" required>
                <option value="" disabled>
                  Choose a time
                </option>
                <FutureSlots />
              </select>
            </label>
          </TaskForm>

          {slots.length ? (
            <ul className="list">
              {slots.map((slot) => (
                <li key={slot.id}>{formatDate(slot.startsAt)}</li>
              ))}
            </ul>
          ) : (
            <p className="empty">You haven’t added any upcoming slots.</p>
          )}
        </section>
      )}
    </div>
  );
}

function TutorReview({ onDirectoryChange }) {
  const result = useLoad("/tutors/review");

  async function review(profileId, data) {
    await api(`/tutors/${profileId}/verification`, {
      method: "PATCH",
      body: { status: data.get("status") },
    });

    result.reload();
    onDirectoryChange();
  }

  return (
    <section className="card stack">
      <div className="row spread">
        <h3>Admin review queue</h3>
        <button
          type="button"
          className="secondary"
          onClick={result.reload}
          disabled={result.loading}
        >
          Refresh queue
        </button>
      </div>

      {result.loading && <p role="status">Loading profiles…</p>}
      {result.error && (
        <p className="error" role="alert">
          {result.error}
        </p>
      )}

      {result.data?.profiles.length === 0 && (
        <p className="empty">No tutor profiles are waiting for review.</p>
      )}

      {result.data?.profiles.map((profile) => (
        <article className="card stack" key={profile.id}>
          <strong>{profile.subjects.join(" · ")}</strong>
          <p>{profile.bio}</p>
          <p>₹{profile.hourlyRate} per hour</p>
          <p className="muted">Applicant ID {profile.userId}</p>

          <TaskForm
            label="Save decision"
            onSubmit={(data) => review(profile.id, data)}
          >
            <label>
              Decision
              <select name="status" defaultValue="" required>
                <option value="" disabled>
                  Choose a decision
                </option>
                <option value="verified">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </label>
          </TaskForm>
        </article>
      ))}
    </section>
  );
}

export default function TutorWorkspace({ user, onDirectoryChange }) {
  const result = useLoad("/tutors/me");

  function refreshProfile() {
    result.reload();
    onDirectoryChange();
  }

  return (
    <details className="card">
      <summary>Tutor workspace</summary>

      <div className="stack details-content">
        {result.loading && <p role="status">Loading your tutor profile…</p>}

        {result.error && (
          <div className="stack">
            <p className="error" role="alert">
              {result.error}
            </p>
            <button type="button" className="secondary" onClick={result.reload}>
              Try again
            </button>
          </div>
        )}

        {result.data && (
          <TutorProfileEditor
            profile={result.data.profile}
            slots={result.data.slots}
            onChange={refreshProfile}
          />
        )}

        {user.role === "admin" && (
          <TutorReview onDirectoryChange={onDirectoryChange} />
        )}
      </div>
    </details>
  );
}
