/* This page gives a minimal fallback when no route matches. */
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <Link className="mt-4 inline-block text-emerald-300" to="/">Go back home</Link>
      </div>
    </div>
  );
}
