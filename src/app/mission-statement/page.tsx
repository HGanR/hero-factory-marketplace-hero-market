"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function MissionStatementPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Video */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/hero-background.mp4" type="video/mp4" />
      </video>
      {/* Keep existing theme as an overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/70 to-slate-900/80" />

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">Hero Market</span>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex items-center justify-center px-4 py-12 relative">
          <div className="w-full max-w-5xl bg-black/50 backdrop-blur-sm rounded-lg p-8 border border-white/10 relative max-h-[90vh] overflow-y-auto">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 mb-6 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              Back
            </button>

            <div className="space-y-12">
              {/* Private Trust Positioning */}
              <section className="space-y-6">
                <h2 className="text-3xl font-bold text-white border-b border-cyan-400/50 pb-2">
                  Private Trust Positioning
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-cyan-300 mb-3">Mission Statement — Private Trust</h3>
                    <p className="text-slate-300 leading-relaxed">
                      Our mission is to support the lawful creation, administration, and preservation of private trusts designed to protect family assets, uphold donor intent, and ensure orderly succession across generations.
                    </p>
                    <p className="text-slate-300 leading-relaxed mt-3">
                      We provide secure, transparent systems that enable grantors and trustees to document authority, manage fiduciary responsibilities, and maintain accurate records without unnecessary exposure or institutional dependency. Our platform exists to reinforce continuity, stewardship, and accountability while respecting privacy, lawful autonomy, and the long-term interests of beneficiaries.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-cyan-300 mb-3">Ethics Statement — Private Trust</h3>
                    <p className="text-slate-300 leading-relaxed mb-3">
                      We adhere to ethical principles rooted in fiduciary duty, lawful conduct, and respect for private property.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-slate-300">
                      <li className="leading-relaxed"><strong>Fiduciary Primacy</strong> Trusts are administered for beneficiaries and purposes, not personal convenience. Our systems reinforce duty of care, loyalty, and prudence.</li>
                      <li className="leading-relaxed"><strong>Lawful Structure</strong> We do not promote secrecy for improper purposes. Privacy is treated as a lawful protection, not a mechanism for concealment or avoidance.</li>
                      <li className="leading-relaxed"><strong>Accuracy and Record Integrity</strong> Records created and maintained on the platform are expected to be truthful, complete, and preserved for continuity and auditability.</li>
                      <li className="leading-relaxed"><strong>Informed Participation</strong> Users retain decision-making authority. Our role is to provide tools and clarity, not coercion or guarantees.</li>
                      <li className="leading-relaxed"><strong>Generational Responsibility</strong> We recognize that decisions made today affect future trustees and beneficiaries and design accordingly.</li>
                    </ol>
                  </div>
                </div>
              </section>

              {/* Religious / Ecclesiastical Trust Positioning */}
              <section className="space-y-6">
                <h2 className="text-3xl font-bold text-white border-b border-cyan-400/50 pb-2">
                  Religious / Ecclesiastical Trust Positioning
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-cyan-300 mb-3">Mission Statement — Religious / Ecclesiastical Trust</h3>
                    <p className="text-slate-300 leading-relaxed">
                      Our mission is to support faith-based, ecclesiastical, and religious organizations in establishing and administering trusts that lawfully protect sacred assets, uphold doctrinal intent, and ensure continuity of mission.
                    </p>
                    <p className="text-slate-300 leading-relaxed mt-3">
                      We provide governance-aware tools that respect religious autonomy while enabling responsible stewardship, transparent recordkeeping, and lawful compliance. Our platform exists to preserve the integrity of religious purpose, protect congregational resources, and support succession without compromising belief, conscience, or sacred trust.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-cyan-300 mb-3">Ethics Statement — Religious / Ecclesiastical Trust</h3>
                    <p className="text-slate-300 leading-relaxed mb-3">
                      We operate with respect for both spiritual authority and temporal responsibility.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-slate-300">
                      <li className="leading-relaxed"><strong>Respect for Doctrine and Conscience</strong> We do not interfere with theological determinations or religious governance decisions. Our role is administrative and infrastructural.</li>
                      <li className="leading-relaxed"><strong>Stewardship of Sacred Assets</strong> Religious property and funds are treated as entrusted resources, not commodities.</li>
                      <li className="leading-relaxed"><strong>Lawful Compliance Without Intrusion</strong> We support lawful reporting and governance while minimizing unnecessary exposure of religious affairs.</li>
                      <li className="leading-relaxed"><strong>Non-Commercial Exploitation</strong> Faith-based entities are never pressured, misled, or monetized through fear or doctrinal claims.</li>
                      <li className="leading-relaxed"><strong>Continuity of Mission</strong> Systems are designed to preserve intent across leadership transitions and generations.</li>
                    </ol>
                  </div>
                </div>
              </section>

              {/* Enterprise / Institutional Trust Positioning */}
              <section className="space-y-6">
                <h2 className="text-3xl font-bold text-white border-b border-cyan-400/50 pb-2">
                  Enterprise / Institutional Trust Positioning
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-cyan-300 mb-3">Mission Statement — Enterprise Trust</h3>
                    <p className="text-slate-300 leading-relaxed">
                      Our mission is to provide enterprise-grade infrastructure for the formation, governance, and administration of institutional trusts, holding companies, and fiduciary entities.
                    </p>
                    <p className="text-slate-300 leading-relaxed mt-3">
                      We deliver auditable, scalable systems that support compliance, internal controls, and long-term operational continuity. Our platform exists to reduce risk, enhance governance transparency, and ensure that fiduciary structures operate with discipline, clarity, and accountability across jurisdictions and time horizons.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-cyan-300 mb-3">Ethics Statement — Enterprise Trust</h3>
                    <p className="text-slate-300 leading-relaxed mb-3">
                      We uphold professional standards consistent with institutional fiduciary practice and corporate governance.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-slate-300">
                      <li className="leading-relaxed"><strong>Governance and Accountability</strong> Structures are supported by clear authority, documented decision-making, and role separation.</li>
                      <li className="leading-relaxed"><strong>Regulatory Alignment</strong> We design for compliance with applicable trust, tax, accounting, and reporting obligations without misrepresentation.</li>
                      <li className="leading-relaxed"><strong>Operational Transparency</strong> Auditability, traceability, and record retention are core design principles.</li>
                      <li className="leading-relaxed"><strong>Risk Awareness</strong> We do not promise immunity from risk. We provide systems that help identify, manage, and document it.</li>
                      <li className="leading-relaxed"><strong>Professional Neutrality</strong> We do not substitute for legal, tax, or fiduciary professionals and clearly disclose platform limitations.</li>
                    </ol>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 text-center text-slate-400 text-sm border-t border-white/10">
          <p>© 2024 Hero Market. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
