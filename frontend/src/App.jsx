import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { api, useLoad } from "./api.js";
import {
  Bookings,
  Group,
  Groups,
  Invite,
  Quiz,
  Tutors,
} from "./StudyPages.jsx";
import Room from "./Room.jsx";

function BrandLink() {
  return (
    <Link className="brand" to="/">
      <img
        className="brand-mark"
        src="/favicon.svg"
        alt=""
        width={38}
        height={38}
      />
      StudySync
    </Link>
  );
}

function Shell({ user, onLogout }) {
  const health = useLoad("/health");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    setError("");

    try {
      await api("/auth/logout", { method: "POST" });
      onLogout();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <a className="skip" href="#main-content">
        Skip to content
      </a>

      <aside className="sidebar">
        <BrandLink />

        <nav aria-label="Workspace">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          {user && <NavLink to="/groups">My groups</NavLink>}
          <NavLink to="/tutors">Find a tutor</NavLink>
          {user && <NavLink to="/bookings">My bookings</NavLink>}
        </nav>

        <div className="account">
          {user ? (
            <>
              <strong>{user.name}</strong>
              <button className="secondary" onClick={logout} disabled={busy}>
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <Link to="/login">Sign in</Link>
          )}

          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span>Study workspace</span>
          <span className="badge" role="status">
            {health.loading
              ? "Checking API…"
              : health.data?.status === "ok" &&
                  health.data?.service === "studysync-api"
                ? "API connected"
                : "API unavailable"}
          </span>
        </header>

        <main className="content stack" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Dashboard({ user }) {
  return (
    <>
      <section className="hero stack">
        <p className="eyebrow">YOUR STUDY SPACE</p>
        <h1>{user ? `Welcome, ${user.name}` : "Better learning, together."}</h1>
        <p>Bring your classmates, notes, and practice into one workspace.</p>

        <div className="row">
          <Link className="button" to={user ? "/groups" : "/register"}>
            {user ? "Open my groups" : "Create an account"}
          </Link>
          {!user && <Link to="/login">Sign in</Link>}
        </div>
      </section>

      <section className="grid" aria-label="StudySync features">
        {[
          [
            "Study groups",
            "Invite classmates and organize material by subject.",
          ],
          [
            "Live rooms",
            "Work through problems together with chat and a whiteboard.",
          ],
          [
            "Practice",
            "Use quizzes and flashcards to review what you learned.",
          ],
          ["Tutoring", "Find verified tutors and book available sessions."],
        ].map(([title, description]) => (
          <article className="card stack" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function Auth({ mode, onLogin }) {
  const register = mode === "register";
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";
  const destination = /^\/(?![\\/])/.test(next) ? next : "/";
  const nextQuery = `?next=${encodeURIComponent(destination)}`;
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setError("");

    if (register && values.name.trim().length < 2) {
      setError("Enter a name with at least two characters.");
      return;
    }

    if (register && values.password !== values.confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const body = {
        email: values.email.trim(),
        password: values.password,
        ...(register ? { name: values.name.trim() } : {}),
      };

      const { user } = await api(`/auth/${mode}`, { method: "POST", body });
      onLogin(user);
      navigate(destination, { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="card auth-card stack">
        <BrandLink />

        <h1>{register ? "Create your account" : "Welcome back"}</h1>
        <p>
          {register
            ? "Set up your study workspace."
            : "Sign in to your study workspace."}
        </p>

        <form className="stack" onSubmit={submit}>
          {register && (
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
              />
            </label>
          )}

          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>

          <label>
            Password
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 12 : undefined}
              maxLength={128}
            />
          </label>

          <button
            className="text-button"
            type="button"
            aria-controls="password"
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? "Hide password" : "Show password"}
          </button>

          {register && (
            <>
              <p className="muted">Use at least 12 characters.</p>
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={128}
                />
              </label>
            </>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
        </form>

        <Link to={(register ? "/login" : "/register") + nextQuery}>
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </Link>
      </section>
    </main>
  );
}

function Protected({ user, loading }) {
  const { pathname, search } = useLocation();

  if (loading) return <p role="status">Checking your session…</p>;

  return user ? (
    <Outlet />
  ) : (
    <Navigate
      to={`/login?next=${encodeURIComponent(pathname + search)}`}
      replace
    />
  );
}

function GroupRoute() {
  const { groupId } = useParams();
  return <Group key={groupId} groupId={groupId} />;
}

function RoomRoute() {
  const { groupId } = useParams();
  return <Room key={groupId} groupId={groupId} />;
}

function QuizRoute() {
  const { groupId, quizId } = useParams();

  return (
    <Quiz key={`${groupId}/${quizId}`} groupId={groupId} quizId={quizId} />
  );
}

function InviteRoute() {
  const { token } = useParams();
  return <Invite key={token} token={token} />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    api("/auth/me", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setUser(data.user);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  function updateSession(nextUser) {
    setUser(nextUser);
    setLoading(false);
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<Auth key="login" mode="login" onLogin={updateSession} />}
      />
      <Route
        path="/register"
        element={
          <Auth key="register" mode="register" onLogin={updateSession} />
        }
      />

      <Route
        element={<Shell user={user} onLogout={() => updateSession(null)} />}
      >
        <Route index element={<Dashboard user={user} />} />
        <Route path="tutors" element={<Tutors user={user} />} />

        <Route element={<Protected user={user} loading={loading} />}>
          <Route path="groups" element={<Groups />} />
          <Route path="groups/:groupId" element={<GroupRoute />} />
          <Route path="groups/:groupId/room" element={<RoomRoute />} />
          <Route
            path="groups/:groupId/quizzes/:quizId"
            element={<QuizRoute />}
          />
          <Route path="invite/:token" element={<InviteRoute />} />
          <Route path="bookings" element={<Bookings />} />
        </Route>

        <Route
          path="*"
          element={
            <section className="stack">
              <h1>Page not found</h1>
              <Link to="/">Back to dashboard</Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
