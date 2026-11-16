# Task 3-a — Specialists marketplace screens (work record)

## Files created (exactly two, nothing else touched)

1. `src/components/screens/market/market-home.tsx` — export `MarketHome({ params }: ScreenProps)`
2. `src/components/screens/market/specialist-detail.tsx` — export `SpecialistDetail({ params }: ScreenProps)`

## market-home.tsx structure

- PageHeader ("Specialists marketplace") + violet-free info banner (tone="info", "Two ways to hire") + two shadcn Tabs.
- Tab "Find specialists": fetches `GET /api/market/specialists` once on mount (load-in-useEffect + reload counter, try/catch/finally, honest error state), then filters CLIENT-SIDE by category chips (All + MARKET_CATEGORIES, active = `bg-slate-900 text-white`) and search text (name/headline/skills). Grid `gap-4 sm:grid-cols-2 xl:grid-cols-3` of clickable/keyboard-accessible Cards (avatar lg, RatingInline, violet badges, verified BadgeCheck, headline line-clamp-2, first 3 skill outline badges, border-t row with `₦/hr` + AvailableDot). Loading/Error("Roster unavailable")/Empty states all honest.
- Tab "Your tasks": fetches `GET /api/market/tasks?workspaceId={businessId}` on FIRST tab open (tasksLoaded flag, no refetch after). Rows: clickable Cards p-4 sm:p-5 with title truncate, "From your intelligence" violet chip when source==="recommendation", meta row (categoryLabel · URGENCY_LABEL · Posted fmtDate · N bid/bids pluralized), right column MarketStatusBadge + compact budget range via fmtNaira(v, {compact:true}). Empty state has "Post your first task" action → market/post. Newest-first sort.

## specialist-detail.tsx structure

- Breadcrumbs (market ← Profile) + fetch `GET /api/market/specialists/{id}`; 404/any error → ErrorState "Specialist not found" with onHome → market, onRetry.
- Header block: avatar lg, name + BadgeCheck (verified), headline; violet badges + category outline Badge + AvailableDot; stats strip `grid-cols-2 sm:grid-cols-4` (rating / reviews / completedJobs / responseTime) in `rounded-xl border p-3` blocks; prominent "Invite to bid on a task" Button scrolls to `#invite` via scrollIntoView.
- SectionCards: About (bio), Skills (outline badges), Showcase (`sm:grid-cols-2` portfolio tiles, EmptyState when empty), Rates (₦ 2xl tnum + "/hour indicative" + bid explainer incl. Languages line).
- Invite CTA: `<div id="invite">` wrapper (SectionCard does not forward id) with SectionCard "Invite to bid"; content = LoadingState rows=2 | inline honest error + Retry | "You have no open tasks yet." + "Post a task first" → market/post | list of OPEN tasks (status==="open", newest first) each with Invite button → `POST /api/market/tasks/{taskId}/invite` body `{ specialistIds: [params.id] }`. Success (invited>0): toast.success("Invitation sent", "{name} will respond with an indicative bid shortly.") and button becomes disabled "Invited". invited===0 + message: neutral toast, no fake success. Failure: toast.error("Could not send the invitation", response error text or "Please try again."). Pilot note line shown under the list verbatim.

## Verification

- `bun run lint` → PASS (clean).
- `bunx tsc --noEmit` → zero errors in the two new files. Pre-existing errors exist elsewhere (examples/, and `src/app/api/market/tasks/[id]/invite/route.ts` has `never[]` typing errors — runtime works, dev log shows 201s; NOT touched per scope, flagging for parent).
- APIs verified live: `GET /api/market/specialists` 200 with 14 specialists; `GET /api/market/specialists/{bad-id}` 404 `{"ok":false,"error":"Specialist not found."}`; `GET /api/market/tasks?workspaceId=swifthaul` 200; `POST .../invite` seen returning 201 in dev.log.

## API contract notes

- No mismatches found. DTO shapes match `SpecialistDTO`/`TaskDTO` in `src/lib/market.ts` (type-only imports used).
- Dev server not restarted; no files outside the two were modified.
