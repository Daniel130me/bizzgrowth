"use client";
// Global app shell: left sidebar + top header + content area.
// Also provides AdminShell (dark variant), OnboardingLayout and PublicLayout.

import React, { useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Database,
  Flag,
  FileText,
  Handshake,
  Home,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  UserCog,
  UserRoundCheck,
  Users,
  X,
  Menu,
  Zap,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useBizz, useBizzNotifications } from "@/lib/store";
import { navigate } from "@/lib/router";
import { signOut } from "@/lib/auth/client";
import { getBusiness, DATE_RANGES } from "@/lib/data/businesses";
import { TestBusinessBanner } from "@/components/screens/prototype/test-businesses";
import { NelloviaLogo } from "@/components/brand/logo";

const APP_NAV = [
  { id: "home", label: "Home", icon: Home },
  // Only in the owner's own workspace — sample businesses have no diagnosis or challenge list.
  // The owner's insights live on the diagnosis page ("More worth knowing"), so Insights is for samples.
  { id: "diagnosis", label: "Diagnosis", icon: Stethoscope, ownOnly: true },
  { id: "challenges", label: "Challenges", icon: Flag, ownOnly: true },
  { id: "performance", label: "Performance", icon: BarChart3 },
  { id: "insights", label: "Insights", icon: Sparkles, demoOnly: true },
  { id: "actions", label: "Actions", icon: ListChecks },
  { id: "market", label: "Specialists", icon: Handshake },
  { id: "ask", label: "Ask", icon: MessageSquareText },
  { id: "data", label: "Data", icon: Database },
  { id: "goals", label: "Goals", icon: Target },
  { id: "reports", label: "Reports", icon: FileText },
];

const SETTINGS_NAV = [
  { id: "brain", label: "Business", icon: Building2 },
  { id: "team", label: "Team", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "account", label: "Account", icon: UserCog },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "ai", label: "AI gateway", icon: Zap },
];

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <button onClick={() => navigate("home")} className="flex items-center rounded-lg" aria-label="Nellovia home">
      <NelloviaLogo dark={dark} />
    </button>
  );
}

function NavLink({ item, active, onClick }: { item: { id: string; label: string; icon: React.ElementType }; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-brand-600" : "text-slate-400")} aria-hidden />
      {item.label}
    </button>
  );
}

function SidebarContent({ route, onNavigate, hideHeader = false }: { route: string; onNavigate?: () => void; hideHeader?: boolean }) {
  const businessId = useBizz((s) => s.businessId);
  const own = businessId === "user-workspace";
  const nav = APP_NAV.filter((item) => ("ownOnly" in item ? own : "demoOnly" in item ? !own : true));
  const go = (id: string) => {
    navigate(id);
    onNavigate?.();
  };
  // In the owner's workspace an insight opens from the diagnosis page, so that stays lit.
  const navActive = (id: string) => route === id || route.startsWith(`${id}/`) || (own && id === "diagnosis" && route.startsWith("insights/"));
  const settingsActive = (id: string) =>
    (id === "brain" && route.startsWith("brain")) ||
    (id === "team" && (route.startsWith("team") || route === "my-actions")) ||
    (id === "billing" && ["settings/plan", "upgrade", "payment-method", "invoices"].some((r) => route.startsWith(r))) ||
    (id === "account" && (route.startsWith("settings/profile") || route.startsWith("settings/security"))) ||
    (id === "privacy" && route.startsWith("settings/privacy")) ||
    (id === "ai" && route.startsWith("settings/ai"));

  return (
    <div className="flex h-full flex-col">
      {!hideHeader && (
        <div className="flex h-14 items-center border-b px-4">
          <Logo />
        </div>
      )}
      <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => (
          <NavLink key={item.id} item={item} active={navActive(item.id)} onClick={() => go(item.id)} />
        ))}
        <div className="pt-4 pb-1 pl-3 pr-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Settings</p>
        </div>
        {SETTINGS_NAV.map((item) => (
          <NavLink key={item.id} item={item} active={settingsActive(item.id)} onClick={() => go(settingsRoute(item.id))} />
        ))}
      </nav>
      <div className="border-t p-3">
        <button
          onClick={() => {
            navigate("prototype-index");
            onNavigate?.();
          }}
          className="w-full rounded-lg px-3 py-1.5 text-left text-[11px] text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        >
          Prototype Map (119 screens)
        </button>
      </div>
    </div>
  );
}

function settingsRoute(id: string): string {
  switch (id) {
    case "brain":
      return "brain";
    case "team":
      return "team";
    case "billing":
      return "settings/plan";
    case "account":
      return "settings/profile";
    case "ai":
      return "settings/ai";
    default:
      return "settings/privacy";
  }
}

function WorkspaceSwitcher() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const setBusiness = useBizz((s) => s.setBusiness);
  const facts = useBizz((s) => s.checkup.facts);
  const manualEntries = useBizz((s) => s.manualEntries);
  const business = getBusiness(businessId, userWorkspace, facts, manualEntries);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-1.5 font-semibold sm:gap-2 sm:px-2">
          {/* The business's own initial, as a light avatar so it never reads as Nellovia's logo. */}
          <span className="flex size-6 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700" aria-hidden>
            {business.name.slice(0, 1)}
          </span>
          <span className="max-w-24 truncate sm:max-w-36">{business.name}</span>
          <Badge variant="outline" className="hidden bg-slate-50 px-1.5 text-[10px] font-normal text-slate-500 sm:inline-flex">
            {business.type === "service" ? "Service" : "Ecommerce"}
          </Badge>
          <ChevronDown className="size-3.5 text-slate-400" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {userWorkspace && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Your workspace</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setBusiness("user-workspace")}>
              <Building2 className="size-4 text-slate-400" aria-hidden />
              <span className="flex-1">{userWorkspace.name}</span>
              {businessId === "user-workspace" && <Badge className="bg-brand-600 text-[10px]">Current</Badge>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs text-muted-foreground">Sample businesses — demo data</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setBusiness("swifthaul")}>
          <Building2 className="size-4 text-slate-400" aria-hidden />
          <span className="flex-1">SwiftHaul Logistics</span>
          <Badge variant="outline" className="text-[10px] font-normal">Sample</Badge>
          {businessId === "swifthaul" && <Badge className="bg-brand-600 text-[10px]">Current</Badge>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setBusiness("korahome")}>
          <Building2 className="size-4 text-slate-400" aria-hidden />
          <span className="flex-1">KoraHome Store</span>
          <Badge variant="outline" className="text-[10px] font-normal">Sample</Badge>
          {businessId === "korahome" && <Badge className="bg-brand-600 text-[10px]">Current</Badge>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("create-workspace")}>
          <Plus className="size-4" aria-hidden />
          New business workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DateRangeControl() {
  const dateRange = useBizz((s) => s.dateRange);
  const setDateRange = useBizz((s) => s.setDateRange);
  const current = DATE_RANGES.find((r) => r.id === dateRange);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 px-0 text-xs font-medium sm:px-3">
          <span className="mx-2 sm:mx-0">
            <CalendarDays className="size-3.5 text-slate-400" aria-hidden />
          </span>
          <span className="hidden sm:inline">{current?.label}</span>
          <span className="sr-only sm:hidden">Change date range</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Reporting period</DropdownMenuLabel>
        {DATE_RANGES.map((r) => (
          <DropdownMenuItem key={r.id} onClick={() => setDateRange(r.id)} className={cn(dateRange === r.id && "bg-brand-50 text-brand-700")}>
            {r.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 pb-1.5 text-[11px] text-muted-foreground">Comparison: previous period · Custom ranges coming soon</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsMenu() {
  const businessId = useBizz((s) => s.businessId);
  const all = useBizz((s) => s.notifications);
  const { items, unread } = useBizzNotifications(businessId, all);
  const markAllRead = useBizz((s) => s.markAllRead);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell className="size-4.5" aria-hidden />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white tnum">{unread}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {items.slice(0, 6).map((n) => (
            <DropdownMenuItem key={n.id} onClick={() => navigate(n.targetRoute)} className="flex cursor-pointer flex-col items-start gap-0.5 py-2.5">
              <span className="flex w-full items-center gap-2">
                {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-brand-600" aria-label="unread" />}
                <span className="flex-1 truncate text-sm font-medium">{n.title}</span>
              </span>
              <span className="line-clamp-1 pl-3.5 text-xs text-muted-foreground">{n.body}</span>
            </DropdownMenuItem>
          ))}
          {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("notifications")} className="justify-center text-sm font-medium text-brand-700">
          Open notification centre
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const user = useBizz((s) => s.user);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {user.name.split(" ").map((p) => p[0]).join("")}
          </span>
          <ChevronDown className="size-3.5 text-slate-400" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("settings/profile")}><UserCog className="size-4" aria-hidden /> Profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("settings/security")}><ShieldCheck className="size-4" aria-hidden /> Security</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("settings/plan")}><CreditCard className="size-4" aria-hidden /> Plan &amp; billing</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("help")}><LifeBuoy className="size-4" aria-hidden /> Help &amp; support</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("feedback")}><MessageSquareText className="size-4" aria-hidden /> Send feedback</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { void signOut().finally(() => navigate("signin")); }}><LogOut className="size-4" aria-hidden /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children, route }: { children: React.ReactNode; route: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const facts = useBizz((s) => s.checkup.facts);
  const manualEntries = useBizz((s) => s.manualEntries);
  const business = getBusiness(businessId, userWorkspace, facts, manualEntries);
  return (
    <div className="flex min-h-screen w-full">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r bg-white lg:block" aria-label="Primary sidebar">
        <SidebarContent route={route} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-white/95 px-3 backdrop-blur sm:px-4">
          <Button variant="ghost" size="icon" className="size-9 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" aria-hidden />
          </Button>
          <WorkspaceSwitcher />
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
            <span
              className={cn(
                "mr-1 hidden items-center gap-1.5 text-[11px] text-muted-foreground xl:flex",
                !business.lastSyncOk && "text-amber-600"
              )}
              title={business.lastSyncNote}
            >
              <span className={cn("size-1.5 rounded-full", business.lastSyncOk ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
              {business.lastSyncNote}
            </span>
            <DateRangeControl />
            <NotificationsMenu />
            <Button variant="ghost" size="icon" className="hidden size-9 sm:inline-flex" onClick={() => navigate("help")} aria-label="Help">
              <CircleHelp className="size-4.5" aria-hidden />
            </Button>
            <UserMenu />
          </div>
        </header>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <button className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
            <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
              <div className="flex h-14 items-center justify-between border-b px-4">
                <Logo />
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="h-[calc(100%-3.5rem)]">
                <SidebarContent route={route} onNavigate={() => setMobileOpen(false)} hideHeader />
              </div>
            </div>
          </div>
        )}
        {/* Development only: while a test business is open, the way back to your own data. */}
        <TestBusinessBanner />
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

// ---------- Admin shell (visually related but distinct) ----------

const ADMIN_NAV = [
  { id: "admin", label: "Dashboard", icon: LayoutDashboard },
  { id: "admin/businesses", label: "Businesses", icon: Building2 },
  { id: "admin/users", label: "Users", icon: Users },
  { id: "admin/specialists", label: "Specialists", icon: UserRoundCheck },
  { id: "admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "admin/sync-health", label: "Sync health", icon: ShieldCheck },
  { id: "admin/jobs", label: "Jobs &amp; imports", icon: Database },
  { id: "admin/ai-audit", label: "AI audit", icon: Sparkles },
  { id: "admin/ai-gateway", label: "AI gateway", icon: Zap },
  { id: "admin/ai-providers", label: "AI providers", icon: KeyRound },
  { id: "admin/waitlist", label: "Waiting list", icon: ListChecks },
  { id: "admin/support", label: "Support inbox", icon: LifeBuoy },
];

function adminSignOut() {
  void signOut().finally(() => navigate("signin"));
}

function AdminSidebarContent({ route, onNavigate }: { route: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b border-slate-800 px-4">
        <Logo dark />
        <Badge className="ml-auto bg-slate-800 text-[10px] font-medium text-slate-300">Internal</Badge>
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const active = route === item.id || (item.id !== "admin" && route.startsWith(item.id));
          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.id);
                onNavigate?.();
              }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label.replace("&amp;", "&")}
            </button>
          );
        })}
      </nav>
      {/* Platform admins are always kept in this area (app-root), so "back to the app" only
          bounced back here — signing out is the way out. */}
      <div className="border-t border-slate-800 p-3">
        <button
          onClick={adminSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children, route }: { children: React.ReactNode; route: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-slate-900 lg:block" aria-label="Admin sidebar">
        <AdminSidebarContent route={route} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="size-9 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open admin navigation">
            <Menu className="size-5" aria-hidden />
          </Button>
          <p className="text-sm font-semibold">Platform administration</p>
          <Badge variant="outline" className="border-slate-300 bg-slate-50 text-[10px] font-medium text-slate-600">Restricted access</Badge>
          <Button variant="ghost" size="sm" className="ml-auto text-slate-600" onClick={adminSignOut}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </header>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <button className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-label="Close admin navigation" />
            <div className="absolute inset-y-0 left-0 w-64 bg-slate-900 shadow-xl">
              <AdminSidebarContent route={route} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

// ---------- Onboarding layout ----------

const ONBOARDING_STEPS = ["Workspace", "Checkup", "Diagnosis", "Ready"];

export function OnboardingLayout({ children, route }: { children: React.ReactNode; route: string }) {
  const stepIndex =
    route === "welcome" || route === "create-workspace" ? 0 : route === "checkup-intro" || route === "onboarding-chat" || route === "journey-confirm" || route === "business-understanding" ? 1 : route.startsWith("first-diagnosis") || route === "improve-diagnosis" ? 2 : 3;
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <ol className="hidden items-center gap-2 sm:flex" aria-label="Setup progress">
            {ONBOARDING_STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[10px] font-bold tnum",
                    i < stepIndex ? "bg-emerald-100 text-emerald-700" : i === stepIndex ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"
                  )}
                >
                  {i + 1}
                </span>
                <span className={cn("text-xs", i === stepIndex ? "font-semibold text-slate-900" : "text-slate-400")}>{s}</span>
                {i < ONBOARDING_STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200" aria-hidden />}
              </li>
            ))}
          </ol>
          <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => navigate("welcome")}>
            Setup options
          </Button>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t bg-white px-6 py-4 text-center text-xs text-muted-foreground">
        Private checkup · Exact figures optional — estimates are fine · You can connect accounts later · Never shared with other businesses
      </footer>
    </div>
  );
}

// ---------- Public layout ----------

export function PublicLayout({ children, route }: { children: React.ReactNode; route: string }) {
  const isAuth = ["signup", "signin", "verify-email", "forgot-password", "reset-password", "accept-invite"].includes(route);
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className={cn("mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:px-6", isAuth ? "max-w-4xl" : "max-w-6xl")}>
          <Logo />
          {!isAuth && (
            <nav aria-label="Public" className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="sm" onClick={() => navigate("pricing")}>Pricing</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("waiting-list")}>Waiting list</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("privacy-policy")}>Privacy</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("terms")}>Terms</Button>
            </nav>
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("signin")}>Sign in</Button>
            <Button size="sm" onClick={() => navigate("signup")} className="hidden sm:inline-flex">Get started</Button>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t bg-slate-50">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Logo />
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <button className="hover:text-foreground hover:underline" onClick={() => navigate("pricing")}>Pricing</button>
            <button className="hover:text-foreground hover:underline" onClick={() => navigate("waiting-list")}>Waiting list</button>
            <button className="hover:text-foreground hover:underline" onClick={() => navigate("privacy-policy")}>Privacy policy</button>
            <button className="hover:text-foreground hover:underline" onClick={() => navigate("terms")}>Terms of service</button>
            <button className="hover:text-foreground hover:underline" onClick={() => navigate("accept-invite")}>Accept invitation</button>
            <button className="hover:text-foreground hover:underline" onClick={() => navigate("prototype-index")}>Prototype map</button>
          </nav>
          <p className="text-xs">© 2026 Nellovia · Built for growing businesses</p>
        </div>
      </footer>
    </div>
  );
}

export function BareLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
