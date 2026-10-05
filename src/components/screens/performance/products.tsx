"use client";
// Screen 30 — Product / Service Performance. Sortable tables; search filter for ecommerce.

import React, { useMemo, useState } from "react";
import { ArrowRight, ArrowUpDown, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProvenanceBadge } from "@/components/shared/badges";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { fmtNaira, fmtNum, fmtPct } from "@/lib/format";
import { fmtMoneyMajor, useBiz } from "./biz";
import type { ScreenProps } from "../view-types";

type SortDir = "asc" | "desc";

function SortHead({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  align = "right",
}: {
  label: string;
  columnKey: string;
  sortKey: string;
  sortDir: SortDir;
  onSort: (key: string) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === columnKey;
  return (
    <th scope="col" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className={`py-2.5 pr-4 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ? <ArrowUpDown className="size-3" aria-hidden /> : <ChevronsUpDown className="size-3 opacity-50" aria-hidden />}
      </button>
    </th>
  );
}

export default function ProductsPerformance(_props: ScreenProps) {
  const { business, navigate } = useBiz();
  const ecom = business.type === "ecommerce";

  const [sortKey, setSortKey] = useState("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");

  const onSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const serviceRows = useMemo(() => {
    const items = business.services ?? [];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return ((a[sortKey as "enquiries" | "customers" | "revenue" | "conversion"] as number) - (b[sortKey as "enquiries" | "customers" | "revenue" | "conversion"] as number)) * dir;
    });
  }, [business.services, sortKey, sortDir]);

  const productRows = useMemo(() => {
    const items = (business.products ?? []).map((p) => ({ ...p, conversion: p.views ? (p.orders / p.views) * 100 : 0 }));
    const dir = sortDir === "asc" ? 1 : -1;
    const q = query.trim().toLowerCase();
    return [...items]
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
        return ((a[sortKey as "views" | "carts" | "orders" | "revenue" | "returns" | "conversion"] as number) - (b[sortKey as "views" | "carts" | "orders" | "revenue" | "returns" | "conversion"] as number)) * dir;
      });
  }, [business.products, sortKey, sortDir, query]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title={ecom ? "Product performance" : "Service performance"}
        description={
          ecom
            ? "Product-level figures from the Shopify catalog — sortable and searchable."
            : "Service-line figures from monthly submissions — sortable by any column."
        }
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("performance")}>
            <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Performance
          </Button>
        }
      />

      {ecom ? (
        <SectionCard
          title="Products"
          description="Views, carts, orders, revenue, conversion and returns per product."
          action={
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                aria-label="Search products"
                className="w-48 pl-8 sm:w-64"
              />
            </div>
          }
        >
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-xs uppercase tracking-wide">
                  <SortHead label="Product" columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" />
                  <SortHead label="Views" columnKey="views" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortHead label="Carts" columnKey="carts" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortHead label="Orders" columnKey="orders" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortHead label="Revenue" columnKey="revenue" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortHead label="Conversion" columnKey="conversion" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortHead label="Returns" columnKey="returns" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {productRows.map((p) => (
                  <tr key={p.id} className="border-b bg-white last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtNum(p.views)}</td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtNum(p.carts)}</td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtNum(p.orders)}</td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtNaira(p.revenue)}</td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtPct(p.conversion)}</td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtNum(p.returns)}</td>
                  </tr>
                ))}
                {productRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      No products match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Services" description="Enquiries, customers, revenue and conversion per service line.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide">
                  <SortHead label="Service" columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" />
                  <SortHead label="Enquiries" columnKey="enquiries" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortHead label="Customers" columnKey="customers" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortHead label="Revenue" columnKey="revenue" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <SortHead label="Conversion" columnKey="conversion" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {serviceRows.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium">{s.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{s.priceRange}</span>
                      {!s.active && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtNum(s.enquiries)}</td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtNum(s.customers)}</td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtMoneyMajor(s.revenue)}</td>
                    <td className="py-2.5 pr-4 text-right tnum">{fmtPct(s.conversion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Provenance note */}
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProvenanceBadge
            provenance={ecom ? "measured" : "user-supplied"}
            source={ecom ? "Shopify catalog sync" : "Manual monthly submission"}
          />
          <p className="text-xs text-muted-foreground">
            {ecom
              ? "Product-level figures come from the Shopify catalog sync. Conversion is calculated as orders ÷ views."
              : "Service-line totals are user-supplied monthly entries. Conversion is calculated from enquiries to customers."}
          </p>
        </div>
        {!business.lastSyncOk && ecom && (
          <p className="mt-2 text-xs text-muted-foreground">
            Note: {business.lastSyncNote} — figures may lag the live store.
          </p>
        )}
      </div>
    </div>
  );
}
