import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Register | Smart Social";
  }, []);

  const validation = useMemo(() => {
    const errors = {};

    if (form.email && !isValidEmail(form.email)) {
      errors.email = "Enter a valid email address.";
    }

    if (form.confirmPassword && form.password !== form.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
  }, [form]);

  const hasValidationErrors = Object.keys(validation).length > 0;

  async function handleSubmit(event) {
    event.preventDefault();
    if (hasValidationErrors) {
      return;
    }

    setSubmitting(true);

    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email,
        password: form.password,
        timezone: "Asia/Kolkata"
      });
      navigate("/", { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-violet-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="app-surface p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-brand-purple">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-orange">Smart Social</p>
              <p className="text-sm text-slate-500">Create your workspace</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Start your team workspace</h1>
          <p className="mt-2 text-sm text-slate-500">Set up your account and jump directly into content planning.</p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">First Name</label>
                <input className="app-input" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Last Name</label>
                <input className="app-input" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Email</label>
              <input
                className="app-input"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
              {validation.email ? <p className="mt-2 text-xs font-medium text-rose-500">{validation.email}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Password</label>
                <input
                  className="app-input"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Confirm Password</label>
                <input
                  className="app-input"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                />
                {validation.confirmPassword ? (
                  <p className="mt-2 text-xs font-medium text-rose-500">{validation.confirmPassword}</p>
                ) : null}
              </div>
            </div>

            <button type="submit" disabled={submitting || hasValidationErrors} className="app-button-primary w-full">
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand-purple">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
