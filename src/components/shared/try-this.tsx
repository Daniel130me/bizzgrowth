"use client";
// "Try this" — ready-to-use words an AI feature wrote for the owner (a message
// to send, what to say). One tap to copy or open in WhatsApp.

import { useState } from "react";
import { ClipboardCheck, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function TryThisBox({ title, body, label = "Try this", whatsapp = true }: { title: string; body: string; label?: string; whatsapp?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy", { description: "Select the text and copy it instead." });
    }
  }
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
      <blockquote className="mt-2 whitespace-pre-line rounded-lg border-l-4 border-emerald-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">
        {body}
      </blockquote>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="bg-white" onClick={copy}>
          {copied ? <ClipboardCheck className="mr-1.5 size-4" aria-hidden /> : <Copy className="mr-1.5 size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {whatsapp ? (
          <Button size="sm" variant="outline" className="bg-white" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(body)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1.5 size-4 text-emerald-600" aria-hidden />
              Open in WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
