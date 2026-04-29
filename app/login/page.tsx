"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
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
    <div className="relative flex min-h-screen items-center justify-center bg-[color:var(--canvas)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(230,0,40,0.08),transparent_28%)]" />
      <div className="absolute right-4 top-4">
        <ThemeToggle compact />
      </div>
      <form
        onSubmit={onSubmit}
        className="glass-panel relative z-10 w-full max-w-sm space-y-6 rounded-3xl border border-slate-200 p-7 shadow-[0_12px_45px_rgba(15,23,42,0.12)]"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-2xl font-black uppercase tracking-tight text-white">
              T
            </div>
            <div>
              <div className="text-2xl font-semibold tracking-tight text-slate-900">TelkomselMerchants</div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Akses merchant</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">Gunakan kredensial merchant Anda</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-600">Email / Username</label>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="soft-input w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
            autoComplete="username"
            placeholder="masukkan email atau username"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-600">Password</label>
          <div className="relative">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              className="soft-input w-full rounded-2xl border border-slate-300 px-4 py-3 pr-12 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
              autoComplete="current-password"
            placeholder="masukkan password"
              required
            />
            <button
              type="button"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? <div className="text-sm font-medium text-rose-600">{error}</div> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Masuk..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
