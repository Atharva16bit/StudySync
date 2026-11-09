import { useState } from "react";
import { api } from "./api.js";

export default function RemoveGroupMember({ groupId, member, onRemoved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function removeMember() {
    if (busy) return;

    const confirmed = window.confirm(
      `Remove ${member.name} from this group? They will lose access to its content.`,
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      await api(`/groups/${groupId}/members/${member.id}`, {
        method: "DELETE",
      });
      onRemoved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={removeMember}
        aria-label={`Remove ${member.name} from the group`}
      >
        {busy ? "Removing…" : "Remove"}
      </button>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
