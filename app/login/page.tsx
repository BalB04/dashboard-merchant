"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      setLoading(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Login failed");
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle compact />
      </div>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-7 shadow-[0_12px_45px_rgba(15,23,42,0.12)] backdrop-blur"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-2xl font-black uppercase tracking-tight text-white">
              T
            </div>
            <div>
              <div className="text-2xl font-semibold tracking-tight text-slate-900">TelkomselMerchants</div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Merchant access</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">Use your merchant credential</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-600">Email / Username</label>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-amber-400 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-200"
            autoComplete="username"
            placeholder="enter email or username"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-600">Password</label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-amber-400 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-200"
            autoComplete="current-password"
            placeholder="enter password"
            required
          />
        </div>

        {error ? <div className="text-sm font-medium text-rose-600">{error}</div> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
