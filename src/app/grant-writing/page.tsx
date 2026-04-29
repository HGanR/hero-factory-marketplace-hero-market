"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Save,
  X,
  Download,
  Calendar,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ELECTRIC_BLUE = "#00D1FF";

type GrantApplication = {
  id: number;
  title: string;
  funderName: string | null;
  deadline: string | null;
  amountRequested: string | null;
  status: "draft" | "submitted" | "awarded" | "declined";
  [key: string]: unknown;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/40 text-slate-300",
  submitted: "bg-cyan-500/40 text-cyan-300",
  awarded: "bg-green-500/40 text-green-300",
  declined: "bg-red-500/40 text-red-300",
};

const GRANT_FORM_KEYS = [
  "title", "funderName", "deadline", "amountRequested", "status",
  "legalStatus", "taxId", "governingDocs", "complianceCerts", "insuranceCoverage",
  "orgLegalName", "orgContactInfo", "orgEntityType", "missionStatement", "visionStatement", "geographicAreas",
  "projectSummary", "primaryGoals", "specificFundingNeeds", "needsStatement",
  "supportingEvidence", "currentEfforts", "stakeholders",
  "alignmentStatement", "alignmentSupportingDocs",
  "staffExpertise", "pastSuccesses", "financialStability", "resources", "partnerships",
  "sustainabilityPlan", "longTermImpact", "replicationScalability",
  "narrative", "budget", "matchingFunds", "fundingSources", "costJustification",
  "evaluationMetrics", "monitoringPlan", "dataCollectionMethods", "reportingSchedule",
  "projectLeader", "financialContact", "authorizedSignatories",
  "goals", "methodology", "timeline",
  "otherRelevantDocs", "flexibilityModifications", "referralSources",
  "ethicalAcknowledgment",
] as const;

const emptyForm = () =>
  Object.fromEntries(GRANT_FORM_KEYS.map((k) => [k, k === "status" ? "draft" : k === "ethicalAcknowledgment" ? false : ""]));

function formToPayload(form: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const key of GRANT_FORM_KEYS) {
    const v = form[key];
    if (key === "ethicalAcknowledgment") payload[key] = !!v;
    else if (key === "status") payload[key] = v || "draft";
    else if (typeof v === "string") payload[key] = v.trim() || null;
    else payload[key] = v ?? null;
  }
  return payload;
}

function applicationToForm(app: GrantApplication): Record<string, unknown> {
  const f = emptyForm();
  for (const key of GRANT_FORM_KEYS) {
    const v = (app as Record<string, unknown>)[key];
    if (v != null) f[key] = typeof v === "boolean" ? v : String(v);
  }
  return f;
}

const inputClass =
  "w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50";
const labelClass = "block text-sm text-slate-400 mb-1";
const sectionClass = "border border-slate-700/50 rounded-xl overflow-hidden";

function FormSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={sectionClass}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800/70 text-left font-medium">
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 space-y-3 border-t border-slate-700/50">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function GrantWritingPage() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [applications, setApplications] = useState<GrantApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<GrantApplication | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const resetForm = useCallback(() => {
    setForm(emptyForm());
    setEditing(null);
    setCreateModal(false);
  }, []);

  const loadApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/grant-writing/applications", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      setApplications(Array.isArray(data?.applications) ? data.applications : []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const hasUser = localStorage.getItem("user") || localStorage.getItem("adminLoggedIn") === "true";
    if (!hasUser) router.push("/");
    else setSessionChecked(true);
  }, [router]);

  useEffect(() => {
    if (sessionChecked) loadApplications();
  }, [sessionChecked, loadApplications]);

  const setFormField = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = async () => {
    if (!String(form.title || "").trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/grant-writing/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formToPayload(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create");
      await loadApplications();
      resetForm();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing || !String(form.title || "").trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/grant-writing/applications/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formToPayload(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update");
      await loadApplications();
      resetForm();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this application?")) return;
    try {
      const res = await fetch(`/api/grant-writing/applications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      await loadApplications();
      setDeleteId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const openEdit = (app: GrantApplication) => {
    setForm(applicationToForm(app));
    setEditing(app);
  };

  const exportToText = (app: GrantApplication) => {
    const a = app as Record<string, unknown>;
    const sect = (title: string, keys: string[]) => {
      const parts = keys
        .filter((k) => a[k])
        .map((k) => `### ${k.replace(/([A-Z])/g, " $1").trim()}\n${a[k]}`);
      if (parts.length === 0) return "";
      return `\n## ${title}\n\n` + parts.join("\n\n");
    };
    const body = [
      sect("1. Required Documentation & Legal Compliance", ["legalStatus", "taxId", "governingDocs", "complianceCerts", "insuranceCoverage"]),
      sect("2. Organizational Information", ["orgLegalName", "orgContactInfo", "orgEntityType", "missionStatement", "visionStatement", "geographicAreas"]),
      sect("3. Project Details", ["projectSummary", "primaryGoals", "specificFundingNeeds"]),
      sect("4. Problem Solving & Background", ["needsStatement", "supportingEvidence", "currentEfforts", "stakeholders"]),
      sect("5. Alignment with Funder Priorities", ["alignmentStatement", "alignmentSupportingDocs"]),
      sect("6. Organizational Capacity", ["staffExpertise", "pastSuccesses", "financialStability", "resources", "partnerships"]),
      sect("7. Sustainability & Long-Term Impact", ["sustainabilityPlan", "longTermImpact", "replicationScalability"]),
      sect("8. Budget & Financials", ["narrative", "budget", "matchingFunds", "fundingSources", "costJustification"]),
      sect("9. Evaluation & Measurement", ["evaluationMetrics", "monitoringPlan", "dataCollectionMethods", "reportingSchedule"]),
      sect("10. Key Contacts & Signatories", ["projectLeader", "financialContact", "authorizedSignatories"]),
      sect("11. Additional Information", ["goals", "methodology", "timeline", "otherRelevantDocs", "flexibilityModifications", "referralSources"]),
    ].join("");
    const lines = [
      `# ${app.title}`,
      "",
      `**Funder:** ${app.funderName || "—"}`,
      `**Deadline:** ${app.deadline || "—"}`,
      `**Amount Requested:** ${app.amountRequested || "—"}`,
      `**Status:** ${app.status}`,
      body,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement("a");
    aEl.href = url;
    aEl.download = `grant-${app.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.txt`;
    aEl.click();
    URL.revokeObjectURL(url);
  };

  const showForm = createModal || editing;
  const isCreate = createModal && !editing;

  const TextArea = ({ name, label, placeholder, rows = 3 }: { name: string; label: string; placeholder?: string; rows?: number }) => (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        value={String(form[name] ?? "")}
        onChange={(e) => setFormField(name, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${inputClass} resize-none`}
      />
    </div>
  );

  const Input = ({ name, label, placeholder, type = "text" }: { name: string; label: string; placeholder?: string; type?: string }) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={String(form[name] ?? "")}
        onChange={(e) => setFormField(name, e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 text-white"
      style={{ backgroundImage: "radial-gradient(ellipse at 20% 20%, rgba(0,209,255,0.08) 0%, transparent 50%)" }}
    >
      <div className="border-b px-6 py-5 flex items-center justify-between flex-wrap gap-4" style={{ borderColor: "rgba(0,209,255,0.3)" }}>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7" style={{ color: ELECTRIC_BLUE }} />
            Grant Writing
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Consulting checklist: 12-section grant proposal preparation. Complete each section and export for submission.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-xl border text-slate-300 hover:text-white" style={{ borderColor: "rgba(0,209,255,0.5)" }}>
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <button
            onClick={() => { resetForm(); setCreateModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold"
            style={{ backgroundColor: "#06b6d4", color: "#000", border: `2px solid ${ELECTRIC_BLUE}` }}
          >
            <Plus className="h-4 w-4" />
            New Application
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {!sessionChecked ? (
          <div className="text-slate-400">Checking session…</div>
        ) : loading ? (
          <div className="text-slate-400">Loading applications…</div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>
        ) : applications.length === 0 ? (
          <div className="rounded-2xl border p-12 text-center" style={{ borderColor: "rgba(0,209,255,0.3)", background: "rgba(0,209,255,0.03)" }}>
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" style={{ color: ELECTRIC_BLUE }} />
            <p className="text-slate-400 mb-4">No grant applications yet.</p>
            <button onClick={() => setCreateModal(true)} className="px-5 py-2.5 rounded-full font-semibold" style={{ backgroundColor: "#06b6d4", color: "#000", border: `2px solid ${ELECTRIC_BLUE}` }}>
              Create your first application
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {applications.map((app) => (
              <div key={app.id} className="rounded-xl border p-5 transition-all hover:border-cyan-500/50" style={{ borderColor: "rgba(0,209,255,0.25)", background: "rgba(0,0,0,0.3)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-lg truncate flex-1">{app.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[app.status] ?? STATUS_COLORS.draft}`}>{app.status}</span>
                </div>
                {app.funderName && <p className="text-sm text-slate-400 truncate">Funder: {app.funderName}</p>}
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  {app.deadline && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{app.deadline}</span>}
                  {app.amountRequested && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{app.amountRequested}</span>}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                  <button onClick={() => openEdit(app)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-slate-600 hover:border-cyan-500/50 text-slate-300"><Pencil className="h-3.5 w-3.5" />Edit</button>
                  <button onClick={() => exportToText(app)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-slate-600 hover:border-cyan-500/50 text-slate-300"><Download className="h-3.5 w-3.5" />Export</button>
                  <button onClick={() => setDeleteId(app.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-red-500/30 hover:border-red-500/60 text-red-400 ml-auto"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 my-8" style={{ borderColor: "rgba(0,209,255,0.4)", background: "linear-gradient(180deg, #0f172a 0%, #0c1222 100%)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{isCreate ? "New Grant Application" : "Edit Application"}</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <FormSection title="3. Project Details" defaultOpen>
                <Input name="title" label="Project Title *" placeholder="Clear and concise project name" />
                <Input name="funderName" label="Grant Funder" placeholder="Organization providing funds" />
                <Input name="deadline" label="Deadline" type="date" />
                <Input name="amountRequested" label="Amount Requested" placeholder="e.g. $50,000" />
                <TextArea name="projectSummary" label="Project Summary" placeholder="1–2 paragraphs overview and objectives" rows={4} />
                <TextArea name="primaryGoals" label="Primary Goals & Objectives" placeholder="Key outcomes and measurable objectives" />
                <TextArea name="specificFundingNeeds" label="Specific Funding Needs" placeholder="What grant funds will cover (equipment, personnel, materials, etc.)" />
                {!isCreate && (
                  <div>
                    <label className={labelClass}>Status</label>
                    <select value={String(form.status ?? "draft")} onChange={(e) => setFormField("status", e.target.value)} className={inputClass}>
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="awarded">Awarded</option>
                      <option value="declined">Declined</option>
                    </select>
                  </div>
                )}
              </FormSection>
              <FormSection title="1. Required Documentation & Legal Compliance">
                <TextArea name="legalStatus" label="Legal Status" placeholder="Proof of nonprofit status, business license, or registration" />
                <Input name="taxId" label="Tax ID / EIN" placeholder="Organization's tax identification" />
                <TextArea name="governingDocs" label="Governing Documents" placeholder="Articles of incorporation, bylaws" />
                <TextArea name="complianceCerts" label="Compliance Certifications" placeholder="Licenses, permits, certifications" />
                <TextArea name="insuranceCoverage" label="Insurance Coverage" placeholder="Details of project/participant insurance" />
              </FormSection>
              <FormSection title="2. Organizational Information">
                <Input name="orgLegalName" label="Full Legal Name of Organization" />
                <TextArea name="orgContactInfo" label="Contact Information" placeholder="Address, phone, email, website" rows={2} />
                <Input name="orgEntityType" label="Type of Entity" placeholder="Nonprofit, For-Profit, NGO, Governmental Agency, etc." />
                <TextArea name="missionStatement" label="Mission Statement" placeholder="Organization's purpose and goals" />
                <TextArea name="visionStatement" label="Vision Statement" placeholder="Long-term impact and aspirations" />
                <TextArea name="geographicAreas" label="Geographic Areas of Operation" placeholder="Countries, regions, communities served" />
              </FormSection>
              <FormSection title="4. Problem Solving Statement & Background">
                <TextArea name="needsStatement" label="Problem Description" placeholder="Clearly articulate the problem this project will address" />
                <TextArea name="supportingEvidence" label="Supporting Evidence" placeholder="Data, statistics, research, testimonials" />
                <TextArea name="currentEfforts" label="Current Efforts" placeholder="Initiatives underway or previously completed" />
                <TextArea name="stakeholders" label="Stakeholders" placeholder="Beneficiaries, partners, impacted communities" />
              </FormSection>
              <FormSection title="5. Alignment with Grant Funder Priorities">
                <TextArea name="alignmentStatement" label="Alignment Statement" placeholder="How project aligns with funder priorities" />
                <TextArea name="alignmentSupportingDocs" label="Supporting Documentation" placeholder="Data/resources underscoring relevance" />
              </FormSection>
              <FormSection title="6. Organizational Capacity and Qualifications">
                <TextArea name="staffExpertise" label="Staff Expertise" placeholder="Key team qualifications and certifications" />
                <TextArea name="pastSuccesses" label="Past Successes" placeholder="Similar projects with measurable outcomes" />
                <TextArea name="financialStability" label="Financial Stability" placeholder="Financial statements or fiscal health summary" />
                <TextArea name="resources" label="Resources" placeholder="Facilities, equipment, technologies" />
                <TextArea name="partnerships" label="Partnerships" placeholder="Partner organizations, collaborators, consultants" />
              </FormSection>
              <FormSection title="7. Sustainability and Long-Term Impact">
                <TextArea name="sustainabilityPlan" label="Sustainability Plan" placeholder="How project continues after grant funding ends" />
                <TextArea name="longTermImpact" label="Long-Term Impact" placeholder="Expected impact on community or field" />
                <TextArea name="replicationScalability" label="Replication & Scalability" placeholder="How project could scale or replicate elsewhere" />
              </FormSection>
              <FormSection title="8. Budget and Financials">
                <TextArea name="budget" label="Detailed Budget" placeholder="Breakdown: personnel, supplies, equipment, travel" />
                <TextArea name="matchingFunds" label="Matching Funds" placeholder="Matching funds, in-kind contributions, co-funding" />
                <TextArea name="fundingSources" label="Funding Sources" placeholder="Other sources applied for, secured, or pending" />
                <TextArea name="costJustification" label="Cost Justification" placeholder="Rationale for key budget items" />
                <TextArea name="narrative" label="Budget Narrative" placeholder="Additional budget explanation" />
              </FormSection>
              <FormSection title="9. Evaluation and Measurement of Success">
                <TextArea name="evaluationMetrics" label="Evaluation Metrics" placeholder="Output, outcome, impact metrics" />
                <TextArea name="monitoringPlan" label="Monitoring Plan" placeholder="How progress will be tracked and reported" />
                <TextArea name="dataCollectionMethods" label="Data Collection Methods" placeholder="Surveys, interviews, observation" />
                <TextArea name="reportingSchedule" label="Reporting Schedule" placeholder="Frequency and format (quarterly, semi-annually)" />
              </FormSection>
              <FormSection title="10. Key Contacts and Signatories">
                <TextArea name="projectLeader" label="Project Leader" placeholder="Name, title, contact of person responsible for oversight" />
                <TextArea name="financialContact" label="Financial Contact" placeholder="Contact for budget-related questions" />
                <TextArea name="authorizedSignatories" label="Authorized Signatories" placeholder="Names and titles authorized to sign" />
              </FormSection>
              <FormSection title="11. Additional Information">
                <TextArea name="goals" label="Additional Goals" />
                <TextArea name="methodology" label="Methodology" />
                <TextArea name="timeline" label="Timeline" placeholder="Start date, milestones, end date" />
                <TextArea name="otherRelevantDocs" label="Other Relevant Documents" placeholder="Research, media supporting the project" />
                <TextArea name="flexibilityModifications" label="Flexibility for Modifications" placeholder="Openness to funder-requested modifications" />
                <Input name="referralSources" label="Referral Sources" placeholder="How you learned about the funding opportunity" />
              </FormSection>
              <FormSection title="12. Ethical Grant Writing Guidelines & Client Acknowledgment">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.ethicalAcknowledgment}
                    onChange={(e) => setFormField("ethicalAcknowledgment", e.target.checked)}
                    className="mt-1 rounded border-slate-600 bg-slate-800"
                  />
                  <span className="text-sm text-slate-300">
                    I confirm compensation via fixed fee only, in compliance with GPA, AFP, AGWA, and 2 CFR 200. Grant funds cannot be used for proposal development unless explicitly authorized by the funder.
                  </span>
                </label>
              </FormSection>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-white">Cancel</button>
              <button
                onClick={isCreate ? handleCreate : handleUpdate}
                disabled={saving || !String(form.title ?? "").trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#06b6d4", color: "#000", border: `2px solid ${ELECTRIC_BLUE}` }}
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : isCreate ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md rounded-xl border p-6" style={{ borderColor: "rgba(255,80,80,0.4)", background: "linear-gradient(180deg, #1e1a1a 0%, #0f0a0a 100%)" }}>
            <p className="text-slate-200 mb-4">Are you sure you want to delete this application?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
