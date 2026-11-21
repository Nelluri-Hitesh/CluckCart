"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function safeNext(next: string | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 transition hover:opacity-90">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white shadow-sm font-bold text-xl">
            🍗
          </span>
          <span className="text-2xl font-black tracking-tight text-ink">chicken<span className="text-brand">mart</span></span>
        </Link>
      </div>
      <div className="card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{msg}</p> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      const data = await post("/api/auth/login", { identifier: f.get("identifier"), password: f.get("password") });
      router.push(data.home === "/" ? safeNext(next, "/") : data.home);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
      setBusy(false);
    }
  }
  return (
    <Shell title="Welcome back" subtitle="Log in with your mobile number or email.">
      <form onSubmit={submit} className="space-y-4">
        <Err msg={err} />
        <div>
          <label className="label" htmlFor="identifier">Mobile number or email</label>
          <input id="identifier" name="identifier" required autoComplete="username" className="input" placeholder="98765 43210" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
        <div className="flex justify-between text-sm">
          <Link href="/forgot-password" className="font-medium text-brand hover:underline">Forgot password?</Link>
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-ink hover:underline">Create account</Link>
        </div>
      </form>
    </Shell>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      await post("/api/auth/register", { name: f.get("name"), phone: f.get("phone"), password: f.get("password") });
      router.push(safeNext(next, "/"));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not register");
      setBusy(false);
    }
  }
  return (
    <Shell title="Create your account" subtitle="Order fresh chicken in a few taps.">
      <form onSubmit={submit} className="space-y-4">
        <Err msg={err} />
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" name="name" required autoComplete="name" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Mobile number</label>
          <div className="flex gap-2">
            <span className="grid place-items-center rounded-xl border border-line bg-surface px-3 text-sm font-semibold">+91</span>
            <input id="phone" name="phone" required inputMode="numeric" autoComplete="tel-national" className="input" placeholder="98765 43210" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="password">Create password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="Create a password" />
          <p className="mt-1 text-xs text-muted">At least 8 characters with letters and numbers.</p>
        </div>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? "Creating account…" : "Sign up"}</button>
        <p className="text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-semibold text-brand hover:underline">Log in</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotForm() {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      const data = await post("/api/auth/forgot", { identifier: f.get("identifier") });
      setMsg(data.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="Reset your password" subtitle="Enter the email or mobile number on your account.">
      {msg ? (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{msg}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Err msg={err} />
          <input name="identifier" required className="input" placeholder="Email or mobile number" aria-label="Email or mobile number" />
          <button className="btn-primary w-full py-3" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link href="/login" className="font-semibold text-brand hover:underline">Back to log in</Link></p>
    </Shell>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr(null);
    try {
      await post("/api/auth/reset", { token, password: f.get("password") });
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }
  return (
    <Shell title="Choose a new password" subtitle="You will be logged out on all devices.">
      {done ? (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">Password updated. Redirecting to log in…</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Err msg={err} />
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="New password" aria-label="New password" />
          <button className="btn-primary w-full py-3">Update password</button>
        </form>
      )}
    </Shell>
  );
}
