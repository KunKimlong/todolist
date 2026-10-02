"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BiLoaderAlt } from "react-icons/bi";
import { HiArrowLeft, HiOutlineCheckCircle } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/auth/account-menu";
import { VerifyCodeStep } from "@/components/auth/verify-code-step";
import { accountApi, type Account, type CodeSent } from "@/lib/api";

function formatChanged(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function SettingsView() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    accountApi
      .get()
      .then(setAccount)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load your account"));
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-10 pb-28 sm:px-8 sm:pt-16">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md text-[0.9375rem] text-muted-foreground hover:text-foreground"
        >
          <HiArrowLeft className="size-4" />
          Tasks
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>

      {loadError && <p className="mt-8 text-[0.9375rem] text-red-600 dark:text-red-400">{loadError}</p>}

      <Section title="Account" description="Password reset codes are sent to this email.">
        <div className="grid gap-1">
          <span className="text-sm text-muted-foreground">Email</span>
          {account ? (
            <span className="text-base font-medium break-all">{account.email}</span>
          ) : (
            <Skeleton className="h-6 w-56" />
          )}
        </div>
      </Section>

      <Section
        title="Password"
        description="To change it, we'll email you a 6-digit code. Changing your password signs you out on other devices."
      >
        {account ? (
          <PasswordReset account={account} onChanged={(updated) => setAccount(updated)} />
        ) : (
          <Skeleton className="h-11 w-48" />
        )}
      </Section>
    </main>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 grid gap-6 border-t pt-8 md:grid-cols-[14rem_1fr] md:gap-10">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function PasswordReset({ account, onChanged }: { account: Account; onChanged: (a: Account) => void }) {
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function sendCode() {
    setSending(true);
    setError(null);
    setDone(false);
    try {
      setSent(await accountApi.sendPasswordCode());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <VerifyCodeStep
        description={
          <>
            Enter the code we sent to <span className="font-medium text-foreground">{sent.sentTo}</span>. It
            expires in {sent.expiresInMinutes} minutes.
          </>
        }
        resendAfterSeconds={sent.resendAfterSeconds}
        onResend={accountApi.sendPasswordCode}
        onSubmit={async (code, newPassword) => {
          await accountApi.changePassword(code, newPassword);
          setSent(null);
          setDone(true);
          toast("Password changed");
          onChanged(await accountApi.get());
        }}
        footer={
          <Button type="button" variant="ghost" size="lg" className="h-11 px-4 text-base" onClick={() => setSent(null)}>
            Cancel
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      {done && (
        <p className="flex items-start gap-2 text-[0.9375rem] text-emerald-700 dark:text-emerald-400">
          <HiOutlineCheckCircle className="mt-0.5 size-5 shrink-0" />
          Your password was changed. Other devices have been signed out.
        </p>
      )}
      <p className="text-[0.9375rem] text-muted-foreground">
        Last changed on {formatChanged(account.passwordChangedAt)}.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div>
        <Button size="lg" variant="outline" className="h-11 px-5 text-base" onClick={sendCode} disabled={sending}>
          {sending && <BiLoaderAlt className="animate-spin" />}
          Reset password
        </Button>
      </div>
    </div>
  );
}
