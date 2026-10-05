"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BiLoaderAlt } from "react-icons/bi";
import { HiArrowLeft } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { VerifyCodeStep } from "./verify-code-step";
import { authApi, type CodeSent } from "@/lib/api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      setSent(await authApi.requestPasswordReset(email.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-24">
        <Link
          href="/login"
          className="inline-flex w-fit items-center gap-1.5 text-[0.9375rem] text-muted-foreground hover:text-foreground"
        >
          <HiArrowLeft className="size-4" />
          Back to sign in
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Reset password</h1>

        {sent ? (
          <div className="mt-8">
            <VerifyCodeStep
              description={
                <>
                  If <span className="font-medium text-foreground break-all">{email.trim().toLowerCase()}</span> is your account
                  email, we&apos;ve sent it a 6-digit code. It expires in {sent.expiresInMinutes} minutes.
                </>
              }
              resendAfterSeconds={sent.resendAfterSeconds}
              onResend={() => authApi.requestPasswordReset(email.trim())}
              onSubmit={async (code, newPassword) => {
                await authApi.confirmPasswordReset(email.trim(), code, newPassword);
                window.location.replace("/login?reset=1");
              }}
              submitLabel="Reset password"
            />
          </div>
        ) : (
          <>
            <p className="mt-2 text-base text-muted-foreground">
              Enter your account email and we&apos;ll send you a code to set a new password.
            </p>
            <form onSubmit={requestCode} className="mt-10 grid gap-5" noValidate>
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
                  autoFocus
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" className="h-11 text-base" disabled={sending || !email.trim()}>
                {sending && <BiLoaderAlt className="animate-spin" />}
                Send code
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
