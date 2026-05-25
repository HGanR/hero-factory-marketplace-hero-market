"use client";

import { useMemo, useState } from "react";
import { Copy, Download, Mail, Search } from "lucide-react";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

const ACCENT = "#00D1FF";

const EMAIL_QUERY_SUFFIX =
  '"@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com" OR "@aol.com" OR "@yahoo.com" OR "@hotmail.com" OR "@msn.com"';

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

type ProviderFilter = "all" | "gmail" | "yahoo" | "hotmail" | "outlook" | "aol" | "msn";

const PROVIDER_CHIPS: ReadonlyArray<{ id: ProviderFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "gmail", label: "Gmail" },
  { id: "yahoo", label: "Yahoo" },
  { id: "hotmail", label: "Hotmail" },
  { id: "outlook", label: "Outlook" },
  { id: "aol", label: "AOL" },
  { id: "msn", label: "MSN" },
];

type Props = {
  industry?: string;
};

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

function matchesProvider(email: string, f: ProviderFilter): boolean {
  if (f === "all") return true;
  const d = email.toLowerCase();
  switch (f) {
    case "gmail":
      return d.endsWith("@gmail.com");
    case "yahoo":
      return d.endsWith("@yahoo.com");
    case "hotmail":
      return d.endsWith("@hotmail.com");
    case "outlook":
      return d.endsWith("@outlook.com");
    case "aol":
      return d.endsWith("@aol.com");
    case "msn":
      return d.endsWith("@msn.com");
    default:
      return true;
  }
}

function safeCsvFilenamePart(s: string): string {
  return s.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "export";
}

function downloadEmailsCsv(emails: string[], baseName: string) {
  const header = "email";
  const body = emails.map((e) => `"${e.replace(/"/g, '""')}"`).join("\n");
  const csv = `${header}\n${body}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeCsvFilenamePart(baseName)}-emails.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EmailMarketingSection({ industry = "" }: Props) {
  const normalizedIndustry = coerceTrimmedString(industry) || "hairstylist";
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [rawData, setRawData] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [dedupeByDomain, setDedupeByDomain] = useState(false);

  const searchQuery = useMemo(
    () => `site:facebook.com "${normalizedIndustry}" ${EMAIL_QUERY_SUFFIX}`,
    [normalizedIndustry],
  );

  const parsedEmails = useMemo(() => {
    const matches = rawData.match(EMAIL_REGEX) ?? [];
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const m of matches) {
      const cleaned = m.trim().toLowerCase();
      if (!cleaned || seen.has(cleaned)) continue;
      seen.add(cleaned);
      unique.push(cleaned);
    }
    return unique;
  }, [rawData]);

  const displayEmails = useMemo(() => {
    let list = parsedEmails.filter((e) => matchesProvider(e, providerFilter));
    if (dedupeByDomain) {
      const sorted = [...list].sort();
      const byDomain = new Map<string, string>();
      for (const e of sorted) {
        const dom = domainOf(e);
        if (!dom) continue;
        if (!byDomain.has(dom)) byDomain.set(dom, e);
      }
      return Array.from(byDomain.values()).sort();
    }
    return [...list].sort();
  }, [parsedEmails, providerFilter, dedupeByDomain]);

  async function copyText(text: string, kind: "query" | "emails") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "query") {
        setCopiedQuery(true);
        window.setTimeout(() => setCopiedQuery(false), 1800);
      } else {
        setCopiedEmails(true);
        window.setTimeout(() => setCopiedEmails(false), 1800);
      }
    } catch {
      // Clipboard failures are non-fatal here.
    }
  }

  return (
    <section id="email-marketing" data-bentley-section="email-marketing" className="py-12 bg-black/80">
      <div className="max-w-6xl mx-auto px-6">
        <div className="rounded-2xl border border-cyan-500/40 bg-slate-950/65 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-2xl font-semibold" style={{ color: ACCENT }}>
                <Mail className="h-6 w-6" />
                Email Marketing
              </h3>
              <p className="mt-2 text-sm text-gray-400 max-w-3xl">
                Use your active pipeline industry in a search query you can copy and paste into any search engine.
                Then paste your collected results below to extract a clean list of email addresses for outreach.
              </p>
            </div>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
              Industry: {normalizedIndustry}
            </span>
          </div>

          <div className="mt-5 rounded-xl border border-cyan-500/30 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-wider text-cyan-300/90">Search Query</p>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-900/70 p-3 text-sm text-slate-200">
              {searchQuery}
            </pre>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyText(searchQuery, "query")}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25"
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedQuery ? "Copied" : "Copy query"}
              </button>
              <span className="text-xs text-gray-500">Copy and paste into a search engine.</span>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-700/70 bg-black/35 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Search className="h-4 w-4 text-cyan-300" />
                Paste search data
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Paste raw search results, copied text, or mixed notes. We will extract emails automatically.
              </p>
              <textarea
                value={rawData}
                onChange={(e) => setRawData(e.target.value)}
                rows={10}
                placeholder="Paste raw search output here..."
                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            <div className="rounded-xl border border-slate-700/70 bg-black/35 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-200">Extracted emails</p>
                <span className="text-xs text-slate-400">
                  {displayEmails.length} shown
                  {parsedEmails.length !== displayEmails.length ? (
                    <span className="text-slate-500"> · {parsedEmails.length} raw</span>
                  ) : null}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by email provider">
                {PROVIDER_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setProviderFilter(chip.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      providerFilter === chip.id
                        ? "border border-cyan-400/60 bg-cyan-500/20 text-cyan-50"
                        : "border border-slate-600/80 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={dedupeByDomain}
                  onChange={(e) => setDedupeByDomain(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40"
                />
                <span>One address per domain (keeps first alphabetically per domain)</span>
              </label>

              <div className="mt-3 min-h-[11rem] max-h-56 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/65 p-3">
                {displayEmails.length === 0 ? (
                  <p className="text-sm text-slate-500">No email addresses match the current filters.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-slate-200">
                    {displayEmails.map((email) => (
                      <li key={email} className="break-all">
                        {email}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={displayEmails.length === 0}
                  onClick={() => void copyText(displayEmails.join("\n"), "emails")}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedEmails ? "Copied" : "Copy email list"}
                </button>
                <button
                  type="button"
                  disabled={displayEmails.length === 0}
                  onClick={() => downloadEmailsCsv(displayEmails, normalizedIndustry)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400/40 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
