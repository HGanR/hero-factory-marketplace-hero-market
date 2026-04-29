"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CLIENT_SERVICE_OPTIONS } from "@/lib/revenue-os/client-service-options";

export function AddClientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string>("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleService(service: string) {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  }

  async function onPickLogo(file: File | null) {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error("Logo file is too large (max 1MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const out = String(reader.result || "");
      if (!out.startsWith("data:image/")) {
        toast.error("Please upload an image file.");
        return;
      }
      setLogoDataUrl(out);
    };
    reader.onerror = () => toast.error("Could not read logo file.");
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      toast.error("Enter a client name");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/revenue-os/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          status: "active",
          logoUrl: logoDataUrl || null,
          requestedServices: selectedServices,
        }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || res.statusText);
      }
      if (data?.id) {
        toast.success("Client created");
        setName("");
        setLogoDataUrl("");
        setSelectedServices([]);
        router.push(`/ai-revenue-os/clients/${data.id}`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-4 rounded-xl border border-white/10 bg-slate-900/30 p-4">
      <div className="grid gap-2">
        <label htmlFor="new-client-name" className="sr-only">
          Client name
        </label>
        <input
          id="new-client-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New client name"
          className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/40 focus:outline-none"
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="new-client-logo" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Client logo
        </label>
        <div className="flex items-center gap-3">
          <input
            id="new-client-logo"
            type="file"
            accept="image/*"
            onChange={(e) => void onPickLogo(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-2 file:font-semibold file:text-cyan-100"
          />
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-cyan-500/40 bg-slate-950/60">
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="Client logo preview" className="h-full w-full object-cover" />
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Requested services</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CLIENT_SERVICE_OPTIONS.map((service) => {
            const checked = selectedServices.includes(service);
            return (
              <label
                key={service}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  checked
                    ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100"
                    : "border-white/10 bg-slate-900/50 text-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleService(service)}
                  className="h-3.5 w-3.5 accent-cyan-400"
                />
                {service}
              </label>
            );
          })}
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Add client"}
      </button>
    </form>
  );
}
