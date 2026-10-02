import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in · Tasks",
};

/** Only allow redirects back into this app, never to another site */
function safeNext(next: string | string[] | undefined) {
  if (typeof next !== "string") return "/";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reset, expired } = await searchParams;
  return <LoginForm next={safeNext(next)} passwordReset={reset === "1"} sessionExpired={expired === "1"} />;
}
