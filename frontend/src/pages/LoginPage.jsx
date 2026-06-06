import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: localStorage.getItem("smart-social-email") || "admin@creatorflow.app",
    password: "Password123!"
  });
  const [rememberMe, setRememberMe] = useState(Boolean(localStorage.getItem("smart-social-email")));
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Login | Smart Social";
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await login(form.email, form.password);

      if (rememberMe) {
        localStorage.setItem("smart-social-email", form.email);
      } else {
        localStorage.removeItem("smart-social-email");
      }

      navigate("/", { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-violet-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="app-surface overflow-hidden p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-brand-orange">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-orange">Smart Social</p>
              <p className="text-sm text-slate-500">CreatorFlow login</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to manage campaigns, schedules, and analytics.</p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Email</label>
              <input
                className="app-input"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="you@brand.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Password</label>
              <div className="relative">
                <input
                  className="app-input pr-12"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-orange focus:ring-orange-200"
              />
              Remember me
            </label>

            <button type="submit" disabled={submitting} className="app-button-primary w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Need an account?{" "}
            <Link to="/register" className="font-semibold text-brand-purple">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
