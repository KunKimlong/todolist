"use client";

import { useEffect, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { BiLoaderAlt } from "react-icons/bi";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";
import { ApiError, type CodeSent } from "@/lib/api";

const CODE_LENGTH = 6;
const MIN_PASSWORD = 8;

interface VerifyCodeStepProps {
  /** Explains where the code went */
  description: React.ReactNode;
  /** Seconds before "Resend code" becomes available */
  resendAfterSeconds: number;
  onResend: () => Promise<CodeSent>;
  onSubmit: (code: string, newPassword: string) => Promise<void>;
  submitLabel?: string;
  footer?: React.ReactNode;
}

function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);
  return [remaining, setRemaining] as const;
}

/** Enter the emailed 6-digit code and choose a new password */
export function VerifyCodeStep({
  description,
  resendAfterSeconds,
  onResend,
  onSubmit,
  submitLabel = "Change password",
  footer,
}: VerifyCodeStepProps) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [resendIn, setResendIn] = useCountdown(resendAfterSeconds);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    code.length === CODE_LENGTH && password.length >= MIN_PASSWORD && confirm === password && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTriedSubmit(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await onSubmit(code, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      // A wrong/expired code needs retyping; the new password can stay
      if (err instanceof ApiError && /code/i.test(err.message)) setCode("");
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const sent = await onResend();
      setCode("");
      setResendIn(sent.resendAfterSeconds);
      setNotice("We sent a new code. Earlier codes no longer work.");
    } catch (err) {
      if (err instanceof ApiError && err.retryAfterSeconds) setResendIn(err.retryAfterSeconds);
      setError(err instanceof Error ? err.message : "Couldn't send a new code");
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
      <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>

      <div className="grid gap-2.5">
        <Label htmlFor="otp-code" className="text-sm font-medium">
          Verification code
        </Label>
        <InputOTP
          id="otp-code"
          maxLength={CODE_LENGTH}
          pattern={REGEXP_ONLY_DIGITS}
          value={code}
          onChange={setCode}
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
          aria-invalid={triedSubmit && code.length < CODE_LENGTH ? true : undefined}
        >
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <InputOTPSlot key={i} index={i} className="size-12 text-lg font-medium sm:size-13" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <div className="text-sm text-muted-foreground">
          Didn&apos;t get it?{" "}
          {resendIn > 0 ? (
            <span className="tabular-nums">Resend in {resendIn}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="new-password" className="text-sm font-medium">
          New password
        </Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={tooShort ? true : undefined}
          aria-describedby="new-password-hint"
        />
        <p
          id="new-password-hint"
          className={tooShort ? "text-sm text-red-600 dark:text-red-400" : "text-sm text-muted-foreground"}
        >
          At least {MIN_PASSWORD} characters.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm-password" className="text-sm font-medium">
          Confirm new password
        </Label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch ? true : undefined}
        />
        {mismatch && <p className="text-sm text-red-600 dark:text-red-400">Passwords don&apos;t match.</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {notice && !error && <p className="text-sm text-muted-foreground">{notice}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" className="h-11 px-5 text-base" disabled={!canSubmit}>
          {submitting && <BiLoaderAlt className="animate-spin" />}
          {submitLabel}
        </Button>
        {footer}
      </div>
    </form>
  );
}
