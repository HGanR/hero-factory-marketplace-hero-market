import Link from "next/link";

export const dynamic = "force-static";

export default function MetallicusIntegrationPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="space-y-2">
        <div className="text-2xl font-semibold">Metallicus</div>
        <div className="text-sm text-muted-foreground">
          Provider profile — payments pathway + compliance-grade proof network posture
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <div className="font-medium">FedNow capability (provider metadata)</div>
        <div className="text-sm text-muted-foreground">
          Metallicus is a certified service provider supporting live transactions on the Federal Reserve’s FedNow Service (as of October 2024).
        </div>
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
          <div className="font-semibold">Important disclaimer</div>
          <div className="mt-1">
            Inclusion of this provider does not imply any endorsement by the Federal Reserve, nor does it indicate that this platform participates in
            or connects directly to the FedNow Service.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-2">
        <div className="font-medium">How this fits in the architecture</div>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>
            <span className="font-semibold text-foreground">This platform</span>: governance, authority, custody controls, audit-grade records.
          </li>
          <li>
            <span className="font-semibold text-foreground">Metallicus</span>: enterprise execution partner for institutions when payments must move instantly.
          </li>
          <li>Integration is a deliberate handoff — verified authority + logged inquiry; no payment initiation inside this platform.</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href="mailto:partnerships@metallicus.com?subject=FedNow%20Integration%20Inquiry%20(via%20Hero%20Market)&body=Hello%20Metallicus%20team%2C%0A%0AWe%20would%20like%20to%20discuss%20an%20enterprise%20integration%20pathway%20for%20instant%20payments%20via%20FedNow.%0A%0AThanks%2C%0A"
          className="inline-flex items-center rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
        >
          Contact Provider
        </a>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md border border-white/10 bg-black/40 px-4 py-2 text-sm font-semibold text-white hover:bg-black/60"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}




