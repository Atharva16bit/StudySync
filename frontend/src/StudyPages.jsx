import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, formatDate, useLoad } from "./api.js";
import GroupSettings from "./GroupSettings.jsx";
import RemoveGroupMember from "./RemoveGroupMember.jsx";
import TutorWorkspace from "./TutorWorkspace.jsx";

const groupSections = ["Resources", "Practice", "Leaderboard", "Members"];
const optionIndexes = [0, 1, 2, 3];

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

function LoadState({ result, children }) {
  if (result.loading) {
    return <p role="status">Loading…</p>;
  }

  if (result.error) {
    return (
      <div className="card stack">
        <p className="error" role="alert">
          {result.error}
        </p>
        <button type="button" className="secondary" onClick={result.reload}>
          Try again
        </button>
      </div>
    );
  }

  return children(result.data);
}

function ActionForm({ children, action, label, reset = true }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    setBusy(true);
    setError("");

    try {
      await action(data);
      if (reset) form.reset();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} aria-busy={busy}>
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? "Working…" : label}
      </button>
    </form>
  );
}

export function Groups() {
  const result = useLoad("/groups");
  const navigate = useNavigate();

  async function create(data) {
    const name = String(data.get("name")).trim();
    const description = String(data.get("description")).trim();

    if (name.length < 2) {
      throw new Error("Enter a group name with at least two characters.");
    }

    const { group } = await api("/groups", {
      method: "POST",
      body: { name, description },
    });

    navigate(`/groups/${group.id}`);
  }

  return (
    <>
      <header className="stack">
        <p className="eyebrow">WORKSPACE</p>
        <h1>My groups</h1>
      </header>

      <section className="card stack">
        <h2>Create a group</h2>

        <ActionForm action={create} label="Create group">
          <label>
            Group name
            <input name="name" required minLength={2} maxLength={80} />
          </label>
          <label>
            Description
            <textarea name="description" maxLength={300} rows={2} />
          </label>
        </ActionForm>
      </section>

      <LoadState result={result}>
        {({ groups }) =>
          groups.length ? (
            <div className="grid">
              {groups.map((group) => (
                <article className="card stack" key={group.id}>
                  <h2>
                    <Link to={`/groups/${group.id}`}>{group.name}</Link>
                  </h2>
                  <p>{group.description || "No description yet."}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty">
              Create a group or open an invitation from a classmate.
            </p>
          )
        }
      </LoadState>
    </>
  );
}

export function Invite({ token }) {
  const navigate = useNavigate();

  async function join() {
    const { group } = await api(
      `/invites/${encodeURIComponent(token)}/accept`,
      { method: "POST" },
    );

    navigate(`/groups/${group.id}`, { replace: true });
  }

  return (
    <section className="card stack">
      <h1>Group invitation</h1>
      <p>Accept this invitation to join the study group.</p>
      <ActionForm action={join} label="Accept invitation" />
    </section>
  );
}

export function Group({ groupId }) {
  const path = `/groups/${groupId}`;
  const result = useLoad(path);
  const [section, setSection] = useState("Resources");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus("Invite link copied.");
    } catch {
      setCopyStatus("Select the link and copy it manually.");
    }
  }

  async function invite() {
    const { token } = await api(`${path}/invites`, { method: "POST" });
    setInviteUrl(
      `${window.location.origin}/invite/${encodeURIComponent(token)}`,
    );
  }

  return (
    <LoadState result={result}>
      {({ group }) => (
        <>
          <Link to="/groups">← My groups</Link>

          <header className="hero stack">
            <p className="eyebrow">STUDY GROUP</p>
            <h1>{group.name}</h1>
            {group.description && <p>{group.description}</p>}

            <div className="row">
              <Link className="button" to={`${path}/room`}>
                Enter study room
              </Link>
              {group.role === "owner" && !inviteUrl && (
                <ActionForm action={invite} label="Invite members" />
              )}
            </div>

            {group.role === "owner" && inviteUrl && (
              <div className="invite-panel stack">
                <label htmlFor="group-invite-url">Invite link</label>
                <div className="row">
                  <input
                    id="group-invite-url"
                    readOnly
                    value={inviteUrl}
                    onFocus={(event) => event.target.select()}
                  />
                  <button type="button" className="secondary" onClick={copyInviteLink}>
                    Copy link
                  </button>
                </div>
                <p className="muted" role="status">{copyStatus}</p>
              </div>
            )}
          </header>

          {group.role === "owner" && (
            <GroupSettings group={group} onSaved={result.reload} />
          )}

          <nav className="tabs" aria-label="Group sections">
            {groupSections.map((name) => (
              <button
                type="button"
                className="secondary"
                key={name}
                aria-pressed={name === section}
                onClick={() => setSection(name)}
              >
                {name}
              </button>
            ))}
          </nav>

          {section === "Resources" && <Resources path={path} />}
          {section === "Practice" && <Practice path={path} />}
          {section === "Leaderboard" && <Leaderboard path={path} />}

          {section === "Members" && (
            <section className="card stack">
              <h2>Members</h2>

              <ul className="list">
                {group.members.map((member) => (
                  <li key={member.id} className="row spread">
                    <span>
                      {member.name} <span className="badge">{member.role}</span>
                    </span>

                    {group.role === "owner" && member.role !== "owner" && (
                      <RemoveGroupMember
                        groupId={group.id}
                        member={member}
                        onRemoved={result.reload}
                      />
                    )}
                  </li>
                ))}
              </ul>


            </section>
          )}
        </>
      )}
    </LoadState>
  );
}

function Resources({ path }) {
  const result = useLoad(`${path}/resources`);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  async function upload(data) {
    const file = data.get("file");

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose a file to upload.");
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Choose a file up to 10 MB.");
    }

    await api(`${path}/resources`, { method: "POST", body: data });
    result.reload();
  }

  return (
    <section className="card stack">
      <h2>Shared resources</h2>

      <ActionForm action={upload} label="Upload resource">
        <label>
          PDF, PNG, JPEG or WebP · up to 10 MB
          <input
            name="file"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            required
          />
        </label>
      </ActionForm>

      <div className="grid">
        <label>
          Search by filename
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label>
          File type
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">All files</option>
            <option value="pdf">PDFs</option>
            <option value="image">Images</option>
          </select>
        </label>
      </div>

      <LoadState result={result}>
        {({ resources }) => {
          if (!resources.length) {
            return (
              <p className="empty">Upload the first resource for this group.</p>
            );
          }

          const search = query.trim().toLowerCase();
          const matches = resources.filter((resource) => {
            const matchesName = resource.filename
              .toLowerCase()
              .includes(search);
            const matchesType =
              type === "all" ||
              (type === "pdf" && resource.mimeType === "application/pdf") ||
              (type === "image" && resource.mimeType?.startsWith("image/"));

            return matchesName && matchesType;
          });

          if (!matches.length) {
            return (
              <p className="empty">No files match your search and filters.</p>
            );
          }

          return (
            <ul className="list">
              {matches.map((resource) => (
                <li key={resource.id}>
                  <a href={`/api${path}/resources/${resource.id}/download`}>
                    {resource.filename}
                  </a>
                </li>
              ))}
            </ul>
          );
        }}
      </LoadState>
    </section>
  );
}

function Practice({ path }) {
  const result = useLoad(`${path}/quizzes`);
  const [kind, setKind] = useState("quiz");
  const [questionCount, setQuestionCount] = useState(1);

  async function publish(data) {
    const title = String(data.get("title")).trim();

    if (!title) {
      throw new Error("Enter a title for your practice set.");
    }

    const questions = Array.from({ length: questionCount }, (_, index) => {
      const prompt = String(data.get(`prompt-${index}`)).trim();

      if (!prompt) {
        throw new Error(`Enter a prompt for item ${index + 1}.`);
      }

      if (kind === "flashcards") {
        const answer = String(data.get(`answer-${index}`)).trim();

        if (!answer) {
          throw new Error(`Enter an answer for card ${index + 1}.`);
        }

        return { prompt, answer };
      }

      const options = optionIndexes.map((option) =>
        String(data.get(`option-${index}-${option}`)).trim(),
      );

      if (options.some((option) => !option)) {
        throw new Error(`Fill in all four options for question ${index + 1}.`);
      }

      return {
        prompt,
        options,
        correctIndex: Number(data.get(`correct-${index}`)),
      };
    });

    await api(`${path}/quizzes`, {
      method: "POST",
      body: { title, kind, questions },
    });

    setQuestionCount(1);
    result.reload();
  }

  return (
    <section className="card stack">
      <h2>Practice sets</h2>

      <LoadState result={result}>
        {({ quizzes }) =>
          quizzes.length ? (
            <ul className="list">
              {quizzes.map((quiz) => (
                <li key={quiz.id}>
                  <Link to={`${path}/quizzes/${quiz.id}`}>{quiz.title}</Link>
                  <span className="badge">
                    {quiz.kind === "quiz" ? "Quiz" : "Flashcards"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Create the group’s first practice set.</p>
          )
        }
      </LoadState>

      <details>
        <summary>Create a practice set</summary>

        <div className="stack details-content">
          <label>
            Format
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setQuestionCount(1);
              }}
            >
              <option value="quiz">Multiple-choice quiz</option>
              <option value="flashcards">Flashcards</option>
            </select>
          </label>

          <ActionForm key={kind} action={publish} label="Publish set">
            <label>
              Title
              <input name="title" required maxLength={100} />
            </label>

            {Array.from({ length: questionCount }, (_, index) => (
              <fieldset key={index} className="stack">
                <legend>
                  {kind === "quiz" ? "Question" : "Card"} {index + 1}
                </legend>

                <label>
                  Prompt
                  <input name={`prompt-${index}`} required maxLength={300} />
                </label>

                {kind === "flashcards" ? (
                  <label>
                    Answer
                    <textarea
                      name={`answer-${index}`}
                      required
                      maxLength={500}
                    />
                  </label>
                ) : (
                  <>
                    {optionIndexes.map((option) => (
                      <label key={option}>
                        Option {option + 1}
                        <input
                          name={`option-${index}-${option}`}
                          required
                          maxLength={200}
                        />
                      </label>
                    ))}

                    <label>
                      Correct option
                      <select name={`correct-${index}`}>
                        {optionIndexes.map((option) => (
                          <option key={option} value={option}>
                            Option {option + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </fieldset>
            ))}

            <div className="row">
              <button
                type="button"
                className="secondary"
                disabled={questionCount >= 20}
                onClick={() =>
                  setQuestionCount((count) => Math.min(20, count + 1))
                }
              >
                Add {kind === "quiz" ? "question" : "card"}
              </button>

              <button
                type="button"
                className="secondary"
                disabled={questionCount <= 1}
                onClick={() =>
                  setQuestionCount((count) => Math.max(1, count - 1))
                }
              >
                Remove last
              </button>
            </div>
          </ActionForm>
        </div>
      </details>
    </section>
  );
}

export function Quiz({ groupId, quizId }) {
  const groupPath = `/groups/${groupId}`;
  const path = `${groupPath}/quizzes/${quizId}`;
  const result = useLoad(path);
  const [attempt, setAttempt] = useState(null);

  async function submitAnswers(data, questions) {
    const answers = questions.map((_, index) => {
      const value = data.get(`q-${index}`);

      if (value === null) {
        throw new Error(`Choose an answer for question ${index + 1}.`);
      }

      return Number(value);
    });

    const savedAttempt = await api(`${path}/attempts`, {
      method: "POST",
      body: { answers },
    });

    if (
      !savedAttempt?.score ||
      !Array.isArray(savedAttempt.review) ||
      savedAttempt.review.length !== questions.length ||
      !savedAttempt.review.every((entry, index) => {
        const optionCount = questions[index].options.length;

        return [entry?.selectedIndex, entry?.correctIndex].every(
          (value) =>
            Number.isInteger(value) && value >= 0 && value < optionCount,
        );
      })
    ) {
      throw new Error("The server returned an incomplete quiz result.");
    }

    setAttempt(savedAttempt);
  }

  return (
    <>
      <Link to={groupPath}>← Back to group</Link>

      <LoadState result={result}>
        {({ quiz }) => (
          <section className="card stack">
            <h1>{quiz.title}</h1>

            {quiz.kind === "flashcards" ? (
              <Flashcards questions={quiz.questions} />
            ) : attempt ? (
              <QuizReview
                questions={quiz.questions}
                attempt={attempt}
                onRetry={() => setAttempt(null)}
              />
            ) : (
              <ActionForm
                label="Submit answers"
                reset={false}
                action={(data) => submitAnswers(data, quiz.questions)}
              >
                {quiz.questions.map((question, index) => (
                  <fieldset className="stack" key={index}>
                    <legend>
                      {index + 1}. {question.prompt}
                    </legend>

                    {question.options.map((option, optionIndex) => (
                      <label className="choice" key={optionIndex}>
                        <input
                          type="radio"
                          name={`q-${index}`}
                          value={optionIndex}
                          required
                        />
                        {option}
                      </label>
                    ))}
                  </fieldset>
                ))}
              </ActionForm>
            )}
          </section>
        )}
      </LoadState>
    </>
  );
}

function QuizReview({ questions, attempt, onRetry }) {
  return (
    <>
      <p role="status">
        Score:{" "}
        <strong>
          {attempt.score.correct} / {attempt.score.total}
        </strong>
      </p>

      <h2>Review your answers</h2>

      <ol className="list ranked">
        {questions.map((question, index) => {
          const { selectedIndex, correctIndex } = attempt.review[index];
          const correct = selectedIndex === correctIndex;

          return (
            <li key={index}>
              <strong>{question.prompt}</strong>
              <p>{correct ? "Correct" : "Incorrect"}</p>
              <p>Your answer: {question.options[selectedIndex]}</p>
              {!correct && (
                <p>Correct answer: {question.options[correctIndex]}</p>
              )}
            </li>
          );
        })}
      </ol>

      <button type="button" className="secondary" onClick={onRetry}>
        Try again
      </button>
    </>
  );
}

function Flashcards({ questions }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  function move(offset) {
    setIndex((position) =>
      Math.min(questions.length - 1, Math.max(0, position + offset)),
    );
    setRevealed(false);
  }

  if (!questions.length) {
    return <p className="empty">This set has no cards.</p>;
  }

  return (
    <div className="stack">
      <p className="muted">
        Card {index + 1} of {questions.length}
      </p>

      <div className="flashcard stack" aria-live="polite">
        <h2>{questions[index].prompt}</h2>
        {revealed && <p>{questions[index].answer}</p>}
      </div>

      <div className="row">
        <button
          type="button"
          className="secondary"
          onClick={() => move(-1)}
          disabled={index === 0}
        >
          Previous
        </button>

        <button type="button" onClick={() => setRevealed((value) => !value)}>
          {revealed ? "Hide answer" : "Reveal answer"}
        </button>

        <button
          type="button"
          className="secondary"
          onClick={() => move(1)}
          disabled={index === questions.length - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Leaderboard({ path }) {
  const result = useLoad(`${path}/leaderboard`);

  return (
    <section className="card stack">
      <h2>Group leaderboard</h2>

      <LoadState result={result}>
        {({ leaderboard }) =>
          leaderboard.length ? (
            <ol className="list ranked">
              {leaderboard.map((entry) => (
                <li key={entry.userId}>
                  {entry.name} <strong>{entry.points} points</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">
              Rankings appear after members submit quiz attempts.
            </p>
          )
        }
      </LoadState>
    </section>
  );
}

export function Tutors({ user }) {
  const result = useLoad("/tutors");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  async function book(tutorId, slotId) {
    try {
      await api("/bookings", {
        method: "POST",
        body: { tutorId, slotId },
      });

      navigate("/bookings");
    } catch (error) {
      if (error.status === 409) {
        throw new Error(
          "That slot was taken. Refresh and choose another time.",
        );
      }

      throw error;
    }
  }

  return (
    <>
      <div className="row spread">
        <h1>Find a tutor</h1>

        <button
          type="button"
          className="secondary"
          onClick={result.reload}
          disabled={result.loading}
        >
          Refresh availability
        </button>
      </div>

      {user && (
        <TutorWorkspace
          key={user.id}
          user={user}
          onDirectoryChange={result.reload}
        />
      )}

      <label>
        Search by name or subject
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <LoadState result={result}>
        {({ tutors }) => {
          const search = query.trim().toLowerCase();

          const matches = tutors.filter((tutor) =>
            [tutor.name, ...tutor.subjects].some((value) =>
              value.toLowerCase().includes(search),
            ),
          );

          if (!matches.length) {
            return <p className="empty">No tutors match your search.</p>;
          }

          return (
            <div className="grid">
              {matches.map((tutor) => (
                <article className="card stack" key={tutor.id}>
                  <div className="row">
                    <h2>{tutor.name}</h2>
                    <span className="badge">Verified tutor</span>
                  </div>

                  <p>{tutor.subjects.join(" · ")}</p>
                  <p>{tutor.bio}</p>
                  <strong>{currency.format(tutor.hourlyRate)} / hour</strong>

                  {!tutor.slots.length ? (
                    <p className="muted">No available slots.</p>
                  ) : user ? (
                    <ActionForm
                      label="Book session"
                      action={(data) => book(tutor.id, data.get("slotId"))}
                    >
                      <label>
                        Available time
                        <select name="slotId" required defaultValue="">
                          <option value="" disabled>
                            Choose a slot
                          </option>

                          {tutor.slots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {formatDate(slot.startsAt)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </ActionForm>
                  ) : (
                    <Link to="/login?next=%2Ftutors">Sign in to book</Link>
                  )}
                </article>
              ))}
            </div>
          );
        }}
      </LoadState>
    </>
  );
}

export function Bookings() {
  const result = useLoad("/bookings");

  async function cancel(id) {
    await api(`/bookings/${id}/cancel`, { method: "POST" });
    result.reload();
  }

  return (
    <>
      <h1>My bookings</h1>

      <LoadState result={result}>
        {({ bookings }) =>
          bookings.length ? (
            <div className="grid">
              {bookings.map((booking) => (
                <article className="card stack" key={booking.id}>
                  <h2>{booking.tutorName}</h2>
                  <p>{formatDate(booking.startsAt)}</p>
                  <span className="badge">{booking.status}</span>

                  {booking.status === "confirmed" &&
                    new Date(booking.startsAt).getTime() > Date.now() && (
                      <details>
                        <summary>Cancel booking</summary>
                        <div className="details-content">
                          <ActionForm
                            action={() => cancel(booking.id)}
                            label="Confirm cancellation"
                          />
                        </div>
                      </details>
                    )}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty">
              You have no bookings. <Link to="/tutors">Find a tutor</Link>.
            </p>
          )
        }
      </LoadState>
    </>
  );
}

