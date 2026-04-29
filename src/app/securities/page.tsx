"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const features = [
  {
    title: "Trust Certificates",
    description:
      "Issue and manage trust certificates representing beneficial interests in trust assets.",
    icon: "📜",
    href: "/securities/certificates",
    gradient: "from-green-600 to-emerald-600",
    features: ["Certificate issuance", "Asset backing registry", "Digital signatures", "Serial number tracking"],
  },
  {
    title: "Member Accounts",
    description:
      "Manage member accounts with KYC verification, beneficial ownership tracking, and account administration.",
    icon: "👥",
    href: "/securities/members",
    gradient: "from-purple-600 to-indigo-600",
    features: ["KYC verification", "Account management", "Beneficial ownership", "Member registry"],
  },
  {
    title: "AML/BSA Compliance",
    description:
      "Monitor transactions and maintain compliance with AML/BSA workflows.",
    icon: "🛡️",
    href: "/securities/compliance",
    gradient: "from-orange-600 to-red-600",
    features: ["Transaction monitoring", "CTR workflow", "SAR workflow", "CIP checks"],
  },
  {
    title: "Payment Processing",
    description:
      "Track payment intake and settlement workflows for trust operations.",
    icon: "💳",
    href: "/securities/payments",
    gradient: "from-cyan-600 to-blue-600",
    features: ["Payment intake", "Transaction tracking", "Reconciliation", "Audit trail"],
  },
  {
    title: "Legal Instruments",
    description:
      "Generate promissory notes, bills of exchange, UCC-1 filings, and related templates.",
    icon: "⚖️",
    href: "/securities/instruments",
    gradient: "from-blue-600 to-indigo-600",
    features: ["Promissory notes", "Bills of exchange", "UCC-1 filings", "Export-ready output"],
  },
  {
    title: "XRPL IOU Processor",
    description:
      "Upload & process negotiable instruments as XRPL IOUs for Corporate Trustee services.",
    icon: "🧬",
    href: "/securities/processor",
    gradient: "from-purple-600 to-blue-600",
    features: ["Instrument intake", "IOU mapping", "Compliance metadata", "Workflow steps"],
  },
] as const;

export default function SecuritiesPage() {
  const router = useRouter();

  // App-session gate
  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/40 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Certificated Securities</h1>
            <p className="text-slate-300 mt-2">
              Professional legal instrument + certificate workflows.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/dashboard" className="text-slate-300 hover:text-white underline">
              Dashboard
            </Link>
            <Link href="/accounting" className="text-slate-300 hover:text-white underline">
              Accounting
            </Link>
            <Link href="/trust" className="text-slate-300 hover:text-white underline">
              Trust
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12 md:pt-16">
        <div className="text-center max-w-4xl mx-auto mb-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-5">
            Professional Legal Instrument
            <br />
            Generation Platform
          </h2>
          <p className="text-lg md:text-xl text-gray-300 leading-relaxed">
            Create legally oriented workflows for instruments, certificates, and member administration.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((f) => (
            <Link key={f.href} href={f.href} className="group block">
              <div className="h-full p-6 bg-slate-800/50 backdrop-blur-sm border border-blue-500/30 rounded-xl hover:border-blue-500/60 transition-all hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1">
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3 text-blue-300">{f.title}</h3>
                <p className="text-gray-300/90 mb-4">{f.description}</p>
                <ul className="space-y-1 text-sm text-gray-400 mb-4">
                  {f.features.map((item) => (
                    <li key={item} className="flex items-center">
                      <span className="text-blue-400 mr-2">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className={`inline-flex items-center px-4 py-2 bg-gradient-to-r ${f.gradient} rounded-lg font-semibold text-sm`}>
                  Launch →
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="p-6 bg-yellow-600/20 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-200">
            ⚠️ <strong>Legal Disclaimer:</strong> This section contains templates and workflow tooling. Always consult qualified legal and financial advisors before using any instruments in real transactions.
          </p>
        </div>
      </div>
    </div>
  );
}


