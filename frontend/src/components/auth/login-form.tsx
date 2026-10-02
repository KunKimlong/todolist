"use client";

import { useState } from "react";
import Link from "next/link";
import { BiLoaderAlt } from "react-icons/bi";
import { HiOutlineCheckCircle, HiOutlineClock } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { PasswordInput } from "./password-input";
import { authApi } from "@/lib/api";

export function LoginForm({
  next,
  passwordReset,
  sessionExpired,
}: {
  next: string;
  passwordReset?: boolean;
  sessionExpired?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.login(email.trim(), password);
      // Full navigation so the server sees the new session cookie
      window.location.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPassword("");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-24">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-base text-muted-foreground">Welcome back. Sign in to see your tasks.</p>

        {passwordReset && (
          <p className="mt-6 flex items-start gap-2 rounded-lg border px-3.5 py-3 text-[0.9375rem]">
            <HiOutlineCheckCircle className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Your password was reset. Sign in with your new password.
          </p>
        )}
        {sessionExpired && !passwordReset && (
          <p className="mt-6 flex items-start gap-2 rounded-lg border px-3.5 py-3 text-[0.9375rem]">
            <HiOutlineClock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            You were signed out to keep your account safe. Please sign in again.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-10 grid gap-5" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 px-3 text-base md:text-base"
              aria-invalid={error ? true : undefined}
              autoFocus
              required
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="mt-1 h-11 text-base"
            disabled={submitting || !email.trim() || !password}
          >
            {submitting && <BiLoaderAlt className="animate-spin" />}
            Sign in
          </Button>
        </form>
      </main>
    </div>
  );
}
