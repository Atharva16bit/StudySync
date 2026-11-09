import { useState } from "react";
import { api, formatDate, useLoad } from "./api.js";

const hourMs = 60 * 60 * 1000;

function ActionForm({ label, action, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");

    try {
      await action(data);
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

function TutorReview({ onDirectoryChange }) {
  const result = useLoad("/tutors/review");
  const profiles = result.data?.profiles ?? [];

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
      <h3>Admin review queue</h3>
      <button
        type="button"
        className="secondary"
        onClick={result.reload}
        disabled={result.loading}
      >
        Refresh queue
      </button>

      {result.loading && <p role="status">Loading profiles…</p>}
      {result.error && (
        <p className="error" role="alert">
          {result.error}
        </p>
      )}
      {result.data && !profiles.length && (
        <p className="empty">No profiles are waiting for review.</p>
      )}

      {profiles.map((profile) => (
        <article className="card stack" key={profile.id}>
          <strong>{profile.subjects.join(" · ")}</strong>
          <p>{profile.bio}</p>
          <p>₹{profile.hourlyRate} per hour</p>
          <p className="muted">Applicant ID {profile.userId}</p>

          <ActionForm
            label="Save decision"
            action={(data) => review(profile.id, data)}
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
          </ActionForm>
        </article>
      ))}
    </section>
  );
}

export default function TutorWorkspace({ user, onDirectoryChange }) {
  const result = useLoad("/tutors/me");
  const profile = result.data?.profile;
  const slots = result.data?.slots ?? [];
  const firstHour = Math.floor(Date.now() / hourMs) + 1;
  const bookedTimes = new Set(
    slots.map((slot) => new Date(slot.startsAt).getTime()),
  );

  const availableTimes = Array.from(
    { length: 72 },
    (_, index) => (firstHour + index) * hourMs,
  ).filter((time) => !bookedTimes.has(time));

  function refresh() {
    result.reload();
    onDirectoryChange();
  }

  async function saveProfile(data) {
    const subjects = String(data.get("subjects"))
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean);

    await api("/tutors/me", {
      method: "PUT",
      body: {
        subjects,
        bio: String(data.get("bio")).trim(),
        hourlyRatePaise: Math.round(Number(data.get("rate")) * 100),
      },
    });

    refresh();
  }

  async function addSlot(data) {
    await api("/tutors/me/slots", {
      method: "POST",
      body: { startsAt: data.get("startsAt") },
    });

    refresh();
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
          <>
            <div className="row spread">
              <h3>Your tutor profile</h3>
              <span className="badge">
                {profile?.verificationStatus ?? "Draft"}
              </span>
            </div>

            <ActionForm label="Submit profile for review" action={saveProfile}>
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
                Bio
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
            </ActionForm>

            {profile && (
              <section className="stack">
                <h3>Your availability</h3>
                <p className="muted">
                  One-hour sessions. Times are shown in your local timezone.
                </p>

                {availableTimes.length ? (
                  <ActionForm label="Add availability" action={addSlot}>
                    <label>
                      Session start
                      <select name="startsAt" defaultValue="" required>
                        <option value="" disabled>
                          Choose a time
                        </option>
                        {availableTimes.map((time) => {
                          const startsAt = new Date(time).toISOString();

                          return (
                            <option key={startsAt} value={startsAt}>
                              {formatDate(startsAt)}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </ActionForm>
                ) : (
                  <p className="empty">
                    You’ve added every slot in the next 72 hours.
                  </p>
                )}

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
          </>
        )}

        {user.role === "admin" && (
          <TutorReview onDirectoryChange={onDirectoryChange} />
        )}
      </div>
    </details>
  );
}
