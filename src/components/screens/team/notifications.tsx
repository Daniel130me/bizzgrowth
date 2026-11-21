"use client";
// Screen 82 — Notifications Centre.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BellOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { useBizz, useBizzNotifications } from "@/lib/store";
import { NOTIFICATIONS } from "@/lib/data/operations";
import { cn } from "@/lib/utils";
import { NOTIF_CATEGORY_META } from "./helpers";
import type { NotificationItem } from "@/lib/types";

export function NotificationsCentre() {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const storeNotifications = useBizz((s) => s.notifications);
  const markRead = useBizz((s) => s.markRead);
  const markAllRead = useBizz((s) => s.markAllRead);
  const { items, unread } = useBizzNotifications(businessId, storeNotifications);

  // Seed the store from the shared dataset on first visit so read/unread state
  // and the header badge stay in sync for the rest of the session.
  useEffect(() => {
    if (useBizz.getState().notifications.length === 0) {
      useBizz.setState({ notifications: NOTIFICATIONS });
    }
  }, []);

  const [category, setCategory] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const categories = useMemo(() => {
    const present = Array.from(new Set(items.map((n) => n.category)));
    return present.map((c) => ({
      id: c as NotificationItem["category"],
      count: items.filter((n) => n.category === c).length,
    }));
  }, [items]);

  const filtered = items.filter(
    (n) => (category === "all" || n.category === category) && (!unreadOnly || !n.read),
  );

  const openNotification = (n: NotificationItem) => {
    if (!n.read) markRead(n.id);
    if (n.targetRoute) navigate(n.targetRoute);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Notifications Centre"
        description="Alerts, assignments, reports, experiment results, connection issues and team activity for this workspace."
        actions={
          <Button variant="outline" disabled={unread === 0} onClick={() => { markAllRead(); toast.success("All notifications marked as read"); }}>
            Mark all read
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="all" className="gap-1.5">
              All <span className="tnum text-[11px] text-muted-foreground">{items.length}</span>
            </TabsTrigger>
            {categories.map((c) => (
              <TabsTrigger key={c.id} value={c.id} className="gap-1.5">
                {NOTIF_CATEGORY_META[c.id].label} <span className="tnum text-[11px] text-muted-foreground">{c.count}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} aria-label="Show unread only" />
          Unread only
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BellOff className="size-5" aria-hidden />}
          title={unreadOnly ? "No unread notifications" : "No notifications in this category"}
          description={
            unreadOnly
              ? "You're all caught up. New alerts, assignments and reports will appear here as they happen."
              : "Try another category or clear the filter. Notifications arrive as your data syncs and your team works."
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-white">
          {filtered.map((n) => {
            const meta = NOTIF_CATEGORY_META[n.category];
            return (
              <li key={n.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.read ? "Read" : "Unread"} notification: ${n.title}`}
                  onClick={() => openNotification(n)}
                  onKeyDown={(e) => e.key === "Enter" && openNotification(n)}
                  className={cn(
                    "group flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    !n.read && "bg-brand-50/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent ring-1 ring-slate-200" : "bg-brand-600",
                    )}
                    aria-label={n.read ? undefined : "Unread"}
                  />
                  <span className="mt-0.5" aria-hidden>
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium " + meta.cls
                      }
                    >
                      {meta.icon}
                      {meta.label}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-sm", n.read ? "font-normal text-foreground" : "font-semibold")}>
                        {n.title}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tnum">{n.time}</span>
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{n.body}</span>
                  </span>
                  {n.read ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Mark "${n.title}" as unread`}
                      onClick={(e) => {
                        e.stopPropagation();
                        useBizz.setState((s) => ({
                          notifications: s.notifications.map((x) => (x.id === n.id ? { ...x, read: false } : x)),
                        }));
                        toast("Marked as unread");
                      }}
                    >
                      <Mail className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Select a notification to open the related screen. Delivery channels are controlled under Notification
        preferences.
      </p>
      <Button variant="ghost" size="sm" className="mt-1" onClick={() => navigate("notification-prefs")}>
        Notification preferences
      </Button>
    </div>
  );
}
