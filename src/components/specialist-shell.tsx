"use client";

import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { NelloviaLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";
import { navigate } from "@/lib/router";

export function SpecialistShell({ children, route }: { children: React.ReactNode; route: string }) {
  async function leave() {
    await signOut();
    navigate("signin");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button className="flex items-center rounded-lg" onClick={() => navigate("specialist/dashboard")}>
            <NelloviaLogo suffix="Specialists" />
          </button>
          <nav className="flex items-center gap-1" aria-label="Specialist navigation">
            <Button variant={route === "specialist/dashboard" ? "secondary" : "ghost"} size="sm" onClick={() => navigate("specialist/dashboard")}>
              <LayoutDashboard className="mr-1.5 size-4" aria-hidden /> Dashboard
            </Button>
            <Button variant={route === "specialist/onboarding" ? "secondary" : "ghost"} size="sm" onClick={() => navigate("specialist/onboarding")}>
              <UserRound className="mr-1.5 size-4" aria-hidden /> Profile
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void leave()} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
