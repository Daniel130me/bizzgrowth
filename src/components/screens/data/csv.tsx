"use client";
// Screens 59–62 — CSV/Excel Upload, Column Mapping, Import Review, Import Result.
// The file never leaves the browser in this prototype; "swifthaul-lead-log-sep.csv"
// is the canonical sample the reviewer path walks through.

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { cn } from "@/lib/utils";
import type { ViewMap } from "../view-types";

function fileNameFor(type: string): string {
  return type === "ecommerce" ? "korahome-sales-log-sep.csv" : "swifthaul-lead-log-sep.csv";
}

const SAMPLE_ROWS: Record<string, string[][]> = {
  service: [
    ["2026-09-03", "Instagram", "14", "1", "45000", "DM enquiry — same-day delivery"],
    ["2026-09-03", "Google Search", "6", "3", "210000", "Corporate quote request"],
    ["2026-09-04", "Instagram", "11", "0", "0", "Price enquiry, not converted"],
    ["2026-09-05", "Referral", "4", "2", "165000", "Referral — interstate move"],
  ],
  ecommerce: [
    ["2026-09-03", "Instagram Ads", "14", "1", "45000", "IG shop session, 1 order"],
    ["2026-09-03", "Google Search", "6", "3", "210000", "Search — dining collection"],
    ["2026-09-04", "Instagram Ads", "11", "0", "0", "Clicked promo, no order"],
    ["2026-09-05", "Organic", "4", "2", "165000", "Repeat buyers"],
  ],
};

const CSV_COLUMNS = ["Date", "Lead Source", "Enquiries", "Customers", "Revenue", "Notes"];
const TARGETS = ["Date", "Channel", "Enquiries", "Customers", "Revenue", "Ignore"];
const DEFAULT_MAP: Record<string, string> = {
  Date: "Date",
  "Lead Source": "Channel",
  Enquiries: "Enquiries",
  Customers: "Customers",
  Revenue: "Revenue",
  Notes: "Ignore",
};

// ---------- Screen 59 — CSV / Excel Upload ----------

function CsvUploadScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const fileName = fileNameFor(business.type);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Upload CSV or Excel"
        description="Import spreadsheets of enquiries, orders, spend or revenue. Column mapping is confirmed before anything is imported."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("data")}>
            Back to Data Centre
          </Button>
        }
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV or Excel file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          navigate("csv-mapping");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging ? "border-blue-400 bg-blue-50/60" : "border-slate-300 bg-slate-50/60 hover:border-blue-300 hover:bg-blue-50/30"
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full border bg-white text-blue-600 shadow-sm">
          <Upload className="size-5" aria-hidden />
        </div>
        <p className="mt-4 text-base font-semibold">Drop your CSV or Excel file here</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Any file is accepted in this prototype. You will confirm the column mapping before anything is imported.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={() => navigate("csv-mapping")}
        />
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-1.5 size-4" aria-hidden /> Browse files
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              toast("Template download simulated", { description: "sample-monthly-template.csv would be downloaded here." });
            }}
          >
            <Download className="mr-1.5 size-4" aria-hidden /> Download sample template
          </Button>
        </div>
      </div>

      <Card className="mt-5 p-5">
        <h2 className="text-sm font-semibold">Supported example datasets</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>· Monthly totals by channel — Date, Channel, Spend, Enquiries, Customers, Revenue</li>
          <li>· Enquiries &amp; outcomes log — Date, Lead Source, Enquiries, Customers, Revenue</li>
          <li>· Orders export — Date, Order ID, Orders, Revenue, Notes</li>
        </ul>
      </Card>

      <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 sm:flex-row">
        <div>
          <p className="text-sm font-medium text-violet-900">Reviewing the prototype?</p>
          <p className="mt-0.5 text-sm text-violet-800/80">Skip the file picker and walk through the mapping flow with {fileName}.</p>
        </div>
        <Button onClick={() => navigate("csv-mapping")} className="shrink-0 bg-violet-600 hover:bg-violet-700">
          Try with sample file
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Files are processed locally in this prototype — nothing is uploaded to a server.
      </p>
    </div>
  );
}

// ---------- Screen 60 — CSV Column Mapping ----------

function CsvMappingScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);

  const [mapping, setMapping] = useState<Record<string, string>>(DEFAULT_MAP);
  const rows = SAMPLE_ROWS[business.type] ?? SAMPLE_ROWS.service;
  const fileName = fileNameFor(business.type);

  const mappedTargets = Object.values(mapping).filter((t) => t !== "Ignore");
  const hasDuplicates = new Set(mappedTargets).size !== mappedTargets.length;
  const missingCore = ["Date", "Channel"].filter((t) => !mappedTargets.includes(t));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Map your columns"
        description="Confirm which CSV column feeds which field. You can ignore columns you don't need."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("csv-upload")}>
            Back to upload
          </Button>
        }
        badge={
          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
            <FileSpreadsheet className="size-3" aria-hidden /> {fileName}
          </Badge>
        }
      />

      <InfoBanner tone="success" title={`${fileName} loaded`}>
        92 rows detected · Sep 1 – Sep 30, 2026. Processing stays on this device.
      </InfoBanner>

      <SectionCard title="Column mapping" className="mt-5" contentClassName="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-40">CSV column</TableHead>
                <TableHead className="w-10" aria-hidden />
                <TableHead className="min-w-44">Maps to</TableHead>
                <TableHead>Sample values</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CSV_COLUMNS.map((col, idx) => (
                <TableRow key={col}>
                  <TableCell className="font-medium">{col}</TableCell>
                  <TableCell className="text-muted-foreground" aria-hidden>
                    →
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping[col] ?? "Ignore"}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [col]: v }))}
                    >
                      <SelectTrigger size="sm" className="w-40" aria-label={`Target for ${col}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGETS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground" title={rows[0]?.[idx]}>
                    {rows[0]?.[idx]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {hasDuplicates || missingCore.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <AlertTriangle className="size-4" aria-hidden /> Mapping needs attention
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-amber-800/90">
            {hasDuplicates ? <li>· Two columns map to the same field — the later column will overwrite the earlier one.</li> : null}
            {missingCore.length > 0 ? <li>· Date and Channel are required for channel-level analysis.</li> : null}
          </ul>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" aria-hidden /> All 5 data fields mapped · Notes ignored.
        </p>
      )}

      <SectionCard title="Preview — first 4 rows" description="Values import exactly as shown; nothing is rounded." className="mt-5" contentClassName="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {CSV_COLUMNS.map((c) => (
                  <TableHead key={c} className="whitespace-nowrap">
                    {c}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">→ {mapping[c]}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((cell, j) => (
                    <TableCell key={j} className={cn("whitespace-nowrap", j >= 2 && j <= 4 && "tnum")}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => navigate("csv-review")} className="flex-1">
          Continue to review <ArrowRight className="ml-1.5 size-4" aria-hidden />
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("csv-upload")}>
          <ArrowLeft className="mr-1.5 size-4" aria-hidden /> Back to upload
        </Button>
      </div>
    </div>
  );
}

// ---------- Screen 61 — Import Review & Validation ----------

function CsvReviewScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);
  const [importing, setImporting] = useState(false);
  const fileName = fileNameFor(business.type);

  function runImport() {
    if (importing) return;
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      navigate("csv-result");
    }, 1500);
  }

  const mappedFields = [
    { csv: "Date", target: "Date" },
    { csv: "Lead Source", target: "Channel" },
    { csv: "Enquiries", target: "Enquiries" },
    { csv: "Customers", target: "Customers" },
    { csv: "Revenue", target: "Revenue" },
    { csv: "Notes", target: "Ignored" },
  ];

  const duplicates = [
    ["2026-09-12", "Referral", "3", "1", "120000", "Referral — duplicate of row 71"],
    ["2026-09-12", "Referral", "3", "1", "120000", "Referral — duplicate of row 72"],
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Review before importing"
        description={`${fileName} — checked for duplicates, missing values and unmapped fields.`}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("csv-mapping")}>
            Back to mapping
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReviewStat label="Rows detected" value="92" tone="neutral" />
        <ReviewStat label="Date range" value="Sep 1 – 30" tone="neutral" sub="2026" />
        <ReviewStat label="Potential duplicates" value="2" tone="amber" sub="Sep 12" />
        <ReviewStat label="Missing values" value="6" tone="amber" sub="Revenue" />
      </div>

      <SectionCard title="Mapped fields" className="mt-5">
        <div className="flex flex-wrap gap-2">
          {mappedFields.map((f) => (
            <Badge key={f.csv} variant="outline" className="gap-1.5 font-normal">
              {f.csv}
              <span aria-hidden>→</span>
              <span className={f.target === "Ignored" ? "text-muted-foreground" : "font-medium text-blue-700"}>{f.target}</span>
            </Badge>
          ))}
        </div>
      </SectionCard>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
          <AlertTriangle className="size-4" aria-hidden /> 2 warnings before import
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-amber-800/90">
          <li>· 2 potential duplicate rows (Sep 12, Sep 12) — identical values; duplicates will be skipped.</li>
          <li>· 6 rows missing Revenue — will import as blank rather than zero.</li>
        </ul>
      </div>

      <SectionCard title="Potential duplicates" description="Highlighted rows are skipped automatically; you can confirm them later in Data Quality." className="mt-5" contentClassName="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Lead Source</TableHead>
                <TableHead>Enquiries</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duplicates.map((r, i) => (
                <TableRow key={i} className="bg-amber-50/60">
                  {r.map((cell, j) => (
                    <TableCell key={j} className={cn("whitespace-nowrap", j >= 2 && j <= 4 && "tnum")}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={runImport} disabled={importing} className="flex-1">
          {importing ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> Importing…
            </>
          ) : (
            <>Import 92 rows</>
          )}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("csv-mapping")} disabled={importing}>
          <ArrowLeft className="mr-1.5 size-4" aria-hidden /> Back to mapping
        </Button>
      </div>
    </div>
  );
}

function ReviewStat({ label, value, tone, sub }: { label: string; value: string; tone: "neutral" | "amber"; sub?: string }) {
  return (
    <Card className={cn("p-4", tone === "amber" && "border-amber-200 bg-amber-50/50")}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tnum leading-none", tone === "amber" && "text-amber-800")}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}

// ---------- Screen 62 — Import Result ----------

function CsvResultScreen() {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const business = getBusiness(businessId, userWorkspace);
  const fileName = fileNameFor(business.type);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Import complete"
        description={`${fileName} finished processing.`}
        badge={
          <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 font-normal text-emerald-700">
            <CheckCircle2 className="size-3" aria-hidden /> 90 rows added
          </Badge>
        }
      />

      <InfoBanner tone="success" title="90 rows imported successfully">
        Daily channel data for September is now part of this workspace. Skipped rows are listed below — nothing was silently dropped.
      </InfoBanner>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/50 p-5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="size-3.5" aria-hidden /> Successful rows
          </p>
          <p className="mt-1.5 text-3xl font-bold tnum leading-none text-emerald-800">90</p>
          <p className="mt-1.5 text-xs text-muted-foreground">Sep 1 – Sep 30, 2026</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50 p-5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="size-3.5" aria-hidden /> Skipped rows
          </p>
          <p className="mt-1.5 text-3xl font-bold tnum leading-none text-amber-800">2</p>
          <p className="mt-1.5 text-xs text-muted-foreground">Duplicates (Sep 12, Sep 12)</p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <XCircle className="size-3.5" aria-hidden /> Failed rows
          </p>
          <p className="mt-1.5 text-3xl font-bold tnum leading-none">0</p>
          <p className="mt-1.5 text-xs text-muted-foreground">No errors</p>
        </Card>
      </div>

      <SectionCard title="Import notes" className="mt-5">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>· 2 duplicate rows skipped — confirm them in Data Quality if they were genuine separate records.</li>
          <li>· 6 rows imported without Revenue — shown as blank in analysis, never counted as zero.</li>
          <li>· Imported values are labelled Measured (file) and can be overridden by manual entries.</li>
        </ul>
      </SectionCard>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => navigate("manual-history")} className="flex-1">
          View imported data
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("csv-upload")}>
          <FileSpreadsheet className="mr-1.5 size-4" aria-hidden /> Import another file
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() => toast("Error report download simulated", { description: "import-errors-swifthaul-lead-log-sep.csv" })}
        >
          <Download className="mr-1.5 size-4" aria-hidden /> Download error report
        </Button>
      </div>
    </div>
  );
}

export const views: ViewMap = {
  "csv-upload": CsvUploadScreen,
  "csv-mapping": CsvMappingScreen,
  "csv-review": CsvReviewScreen,
  "csv-result": CsvResultScreen,
};
