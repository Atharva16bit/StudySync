import { useState } from "react";
import { Link } from "react-router";
import "./AuthPage.css";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";

  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));

    setNotice("");
  }

  function validate() {
    const nextErrors = {};

    if (isRegister && values.name.trim().length < 2) {
      nextErrors.name = "Enter at least 2 characters.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!values.password) {
      nextErrors.password = "Enter your password.";
    } else if (isRegister && values.password.length < 12) {
      nextErrors.password = "Use at least 12 characters.";
    }

    if (isRegister && values.confirmPassword !== values.password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    return nextErrors;
  }

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);
    setNotice("");

    if (Object.keys(nextErrors).length > 0) {
      const firstField = Object.keys(nextErrors)[0];
      event.currentTarget.elements.namedItem(firstField)?.focus();
      return;
    }

    setNotice(
      "Form validation passed. Authentication is not connected yet, " +
        "so no account was created and you have not been signed in.",
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-brand" to="/">
          StudySync
        </Link>

        <p className="auth-eyebrow">
          {isRegister ? "START LEARNING TOGETHER" : "YOUR STUDY SPACE"}
        </p>

        <h1 id="auth-title">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>

        <p className="auth-description">
          {isRegister
            ? "A shared space for your people, notes, and ideas."
            : "Sign in to continue your learning journey."}
        </p>

        <p className="auth-preview">
          UI preview — account services are being built.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {isRegister && (
            <div className="form-field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                value={values.name}
                onChange={handleChange}
                maxLength={80}
                required
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name && (
                <p className="field-error" id="name-error">
                  {errors.name}
                </p>
              )}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={values.email}
              onChange={handleChange}
              maxLength={254}
              required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <p className="field-error" id="email-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="form-field">
            <div className="password-heading">
              <label htmlFor="password">Password</label>

              <button
                className="password-toggle"
                type="button"
                aria-controls="password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((previous) => !previous)}
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
            </div>

            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={values.password}
              onChange={handleChange}
              required
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password
                  ? "password-error"
                  : isRegister
                    ? "password-hint"
                    : undefined
              }
            />

            {errors.password ? (
              <p className="field-error" id="password-error">
                {errors.password}
              </p>
            ) : (
              isRegister && (
                <p className="field-hint" id="password-hint">
                  Use at least 12 characters. A long passphrase works well.
                </p>
              )
            )}
          </div>

          {isRegister && (
            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={
                  errors.confirmPassword ? "confirm-password-error" : undefined
                }
              />
              {errors.confirmPassword && (
                <p className="field-error" id="confirm-password-error">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          <button className="auth-submit" type="submit">
            {isRegister ? "Create account" : "Sign in"}
          </button>

          <div role="status">
            {notice && <p className="auth-notice">{notice}</p>}
          </div>
        </form>

        <p className="auth-switch">
          {isRegister ? "Already have an account? " : "New to StudySync? "}
          <Link to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>

        <Link className="auth-back" to="/">
          Back to dashboard preview
        </Link>
      </section>
    </main>
  );
}
