"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HiOutlineArrowRightOnRectangle, HiOutlineCog6Tooth, HiOutlineUserCircle } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authApi } from "@/lib/api";

export function AccountMenu() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .me()
      .then((user) => setEmail(user.email))
      .catch(() => {});
  }, []);

  async function signOut() {
    try {
      await authApi.logout();
    } catch {
      toast.error("Couldn't sign out. Please try again.");
      return;
    }
    window.location.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Account"
            className="text-muted-foreground"
          />
        }
      >
        <HiOutlineUserCircle className="size-[22px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2">
            <span className="block text-xs text-muted-foreground">Signed in as</span>
            <span className="block truncate text-[0.9375rem] font-medium text-foreground">
              {email ?? "…"}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="py-2 text-[0.9375rem]" onClick={() => router.push("/settings")}>
          <HiOutlineCog6Tooth />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem className="py-2 text-[0.9375rem]" onClick={signOut}>
          <HiOutlineArrowRightOnRectangle />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
