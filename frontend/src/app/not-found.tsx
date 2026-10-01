import type { Metadata } from "next";
import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi2";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Page not found · Tasks",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pb-24">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        There&apos;s nothing at this address. It may have moved, or the link might be mistyped.
      </p>
      <div className="mt-8">
        <Link href="/" className={cn(buttonVariants({ size: "lg" }), "h-10 gap-2 px-4 text-[0.9375rem]")}>
          <HiArrowLeft className="size-4" />
          Back to tasks
        </Link>
      </div>
    </main>
  );
}
