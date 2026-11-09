import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "./api.js";

export default function GroupSettings({ group, onSaved }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const path = `/groups/${group.id}`;

  async function save(event) {
    event.preventDefault();
    if (busy) return;

    const data = new FormData(event.currentTarget);
    setBusy("save");
    setError("");

    try {
      await api(path, {
        method: "PATCH",
        body: {
          name: String(data.get("name")).trim(),
          description: String(data.get("description")).trim(),
        },
      });

      onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteGroup() {
    if (busy) return;

    const confirmed = window.confirm(
      `Remove "${group.name}"? Members will lose access and its invite links will stop working.`,
    );

    if (!confirmed) return;

    setBusy("delete");
    setError("");

    try {
      await api(path, { method: "DELETE" });
      navigate("/groups", { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <details className="card">
      <summary>Group settings</summary>

      <div className="stack details-content">
        <form className="stack" onSubmit={save}>
          <fieldset className="stack" disabled={Boolean(busy)}>
            <legend>Edit group details</legend>

            <label>
              Group name
              <input
                name="name"
                defaultValue={group.name}
                required
                minLength={2}
                maxLength={80}
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                defaultValue={group.description ?? ""}
                maxLength={300}
                rows={3}
              />
            </label>

            <button type="submit">
              {busy === "save" ? "Saving…" : "Save changes"}
            </button>
          </fieldset>
        </form>

        <button
          type="button"
          className="secondary"
          disabled={Boolean(busy)}
          onClick={deleteGroup}
        >
          {busy === "delete" ? "Removing…" : "Delete group"}
        </button>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
