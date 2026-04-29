"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { getTemplateForResolution } from "@/lib/governance/resolution-templates";

type StepKey = "type" | "context" | "details" | "participants" | "agenda" | "resolutions" | "exhibits" | "review";

const STEPS: { key: StepKey; title: string }[] = [
  { key: "type", title: "Record Type" },
  { key: "context", title: "Entity Context" },
  { key: "details", title: "Meeting Details" },
  { key: "participants", title: "Participants & Authority" },
  { key: "agenda", title: "Agenda Items" },
  { key: "resolutions", title: "Resolutions" },
  { key: "exhibits", title: "Exhibits & Attachments" },
  { key: "review", title: "Review & Submit" },
];

type Participant = {
  id: string;
  personId?: string;
  personName: string;
  role: string;
  present: boolean;
  votingPower: number;
};

type AgendaItem = {
  id: string;
  title: string;
  description: string;
  actionTaken: boolean;
};

type Resolution = {
  id: string;
  title: string;
  resolutionType: string;
  text: string;
  effectiveDate: string;
  expirationDate?: string;
  monetaryThreshold?: number;
  counterparty?: string;
  approvalThreshold: string;
  isStanding: boolean;
  standingScope?: any;
};

type WizardData = {
  recordType: "meeting" | "written_consent";
  includesResolutions: boolean;
  entityName?: string;
  entityType?: string;
  jurisdiction?: string;
  title: string;
  actionDate: string;
  actionTime?: string;
  location?: string;
  calledBy?: string;
  chair?: string;
  participants: Participant[];
  agendaItems: AgendaItem[];
  resolutions: Resolution[];
  exhibits: any[];
};

async function apiPost<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Request failed");
  return json as T;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET", credentials: "include" });
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Request failed");
  return json as T;
}

export default function MinutesWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trustId = searchParams?.get("trustId") || null;
  const entityId = searchParams?.get("entityId") || null;
  const clientId = searchParams?.get("clientId") || null;

  const [currentStep, setCurrentStep] = useState<StepKey>("type");
  const [minuteBookId, setMinuteBookId] = useState<string | null>(null);
  const [minutesId, setMinutesId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [context, setContext] = useState<any>(null);

  const [data, setData] = useState<WizardData>({
    recordType: "meeting",
    includesResolutions: true,
    title: "",
    actionDate: new Date().toISOString().slice(0, 10),
    participants: [],
    agendaItems: [],
    resolutions: [],
    exhibits: [],
  });

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  // Load context and ensure minute book
  useEffect(() => {
    (async () => {
      if (!clientId || (!trustId && !entityId)) {
        setErr("Missing required context: clientId and (trustId or entityId)");
        return;
      }

      try {
        // Ensure minute book exists
        const bookRes = await apiPost<{ ok: true; minuteBookId: string }>("/api/governance/minute-books/ensure", {
          clientId,
          trustId,
          entityId,
          entityType: trustId ? "Trust" : "LLC",
        });
        setMinuteBookId(bookRes.minuteBookId);

        // Load entity/trust context for auto-fill
        // This would come from your existing context API
        setContext({ clientId, trustId, entityId });
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [clientId, trustId, entityId]);

  async function saveDraft() {
    if (!minuteBookId) return;

    setBusy(true);
    setErr(null);
    try {
      if (!minutesId) {
        // Create new minute
        const res = await apiPost<{ ok: true; minutes: any }>("/api/governance/minutes", {
          minuteBookId,
          recordType: data.recordType === "meeting" ? "MEETING" : "WRITTEN_CONSENT",
          title: data.title || "Draft Minutes",
          actionDate: data.actionDate,
          actionTime: data.actionTime,
          location: data.location,
          calledBy: data.calledBy,
          chair: data.chair,
          quorumRequired: data.recordType === "meeting",
          agenda: data.agendaItems.length > 0 ? data.agendaItems : null,
        });
        setMinutesId(res.minutes.id);
      } else {
        // Update existing (would need PATCH endpoint)
        // For now, we'll just save locally
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!minutesId) {
      await saveDraft();
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      await apiPost(`/api/governance/minutes/${minutesId}/submit`, {});
      router.push(`/trust-records/governance/minutes/${minutesId}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Minutes & Resolutions Wizard</h1>
        <p className="text-sm text-muted-foreground">
          Create meeting minutes or written consent with resolutions and approvals.
        </p>
      </header>

      {err && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-6">
        <aside className="w-72 shrink-0 border rounded-lg p-4">
          <div className="text-sm font-medium mb-3">Steps</div>
          <ol className="space-y-2">
            {STEPS.map((s, idx) => (
              <li key={s.key}>
                <button
                  className={`w-full text-left text-sm rounded-md px-3 py-2 ${
                    idx === stepIndex ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"
                  }`}
                  onClick={() => setCurrentStep(s.key)}
                  disabled={busy}
                >
                  {idx + 1}. {s.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main className="flex-1 border rounded-lg p-6">
          {currentStep === "type" && (
            <StepRecordType
              data={data}
              onChange={(updates) => setData({ ...data, ...updates })}
              onNext={() => setCurrentStep("context")}
            />
          )}

          {currentStep === "context" && (
            <StepContext
              data={data}
              context={context}
              onChange={(updates) => setData({ ...data, ...updates })}
              onBack={() => setCurrentStep("type")}
              onNext={() => setCurrentStep("details")}
            />
          )}

          {currentStep === "details" && (
            <StepMeetingDetails
              data={data}
              onChange={(updates) => setData({ ...data, ...updates })}
              onBack={() => setCurrentStep("context")}
              onNext={() => setCurrentStep("participants")}
            />
          )}

          {currentStep === "participants" && (
            <StepParticipants
              data={data}
              onChange={(updates) => setData({ ...data, ...updates })}
              onBack={() => setCurrentStep("details")}
              onNext={() => setCurrentStep("agenda")}
            />
          )}

          {currentStep === "agenda" && (
            <StepAgenda
              data={data}
              onChange={(updates) => setData({ ...data, ...updates })}
              onBack={() => setCurrentStep("participants")}
              onNext={() => setCurrentStep("resolutions")}
            />
          )}

          {currentStep === "resolutions" && (
            <StepResolutions
              data={data}
              entityType={context?.entityType || "Trust"}
              onChange={(updates) => setData({ ...data, ...updates })}
              onBack={() => setCurrentStep("agenda")}
              onNext={() => setCurrentStep("exhibits")}
            />
          )}

          {currentStep === "exhibits" && (
            <StepExhibits
              data={data}
              minutesId={minutesId}
              onChange={(updates) => setData({ ...data, ...updates })}
              onBack={() => setCurrentStep("resolutions")}
              onNext={() => setCurrentStep("review")}
            />
          )}

          {currentStep === "review" && (
            <StepReview
              data={data}
              busy={busy}
              onBack={() => setCurrentStep("exhibits")}
              onSave={saveDraft}
              onSubmit={submit}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// Step Components

function StepRecordType({
  data,
  onChange,
  onNext,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Record Type Selection</h2>
      <RadioGroup
        value={data.recordType}
        onValueChange={(v) => onChange({ recordType: v as "meeting" | "written_consent" })}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="meeting" id="meeting" />
          <Label htmlFor="meeting" className="cursor-pointer">
            Meeting Minutes
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="written_consent" id="written_consent" />
          <Label htmlFor="written_consent" className="cursor-pointer">
            Written Consent (In Lieu of Meeting)
          </Label>
        </div>
      </RadioGroup>

      <div className="flex items-center space-x-2">
        <Checkbox
          checked={data.includesResolutions}
          onCheckedChange={(checked) => onChange({ includesResolutions: !!checked })}
        />
        <Label>Includes Resolution(s)?</Label>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepContext({
  data,
  context,
  onChange,
  onBack,
  onNext,
}: {
  data: WizardData;
  context: any;
  onChange: (updates: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Entity Governance Context</h2>
      <div className="space-y-2">
        <Label>Entity / Trust Name (auto-filled)</Label>
        <Input value={data.entityName || context?.entityName || ""} readOnly className="bg-muted" />
      </div>
      <div className="space-y-2">
        <Label>Entity Type (auto-filled)</Label>
        <Input value={data.entityType || context?.entityType || "Trust"} readOnly className="bg-muted" />
      </div>
      <div className="space-y-2">
        <Label>Jurisdiction (auto-filled)</Label>
        <Input value={data.jurisdiction || ""} readOnly className="bg-muted" />
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepMeetingDetails({
  data,
  onChange,
  onBack,
  onNext,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Meeting / Action Details</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date of Action *</Label>
          <Input
            type="date"
            value={data.actionDate}
            onChange={(e) => onChange({ actionDate: e.target.value })}
            required
          />
        </div>
        {data.recordType === "meeting" && (
          <div className="space-y-2">
            <Label>Time (optional)</Label>
            <Input
              type="time"
              value={data.actionTime || ""}
              onChange={(e) => onChange({ actionTime: e.target.value })}
            />
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label>Title *</Label>
        <Input
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g., Organizational Meeting Minutes"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Location / Method</Label>
        <Select
          value={data.location || ""}
          onValueChange={(v) => onChange({ location: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select location/method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Physical">Physical Meeting</SelectItem>
            <SelectItem value="Teleconference">Teleconference</SelectItem>
            <SelectItem value="Written Consent">Written Consent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Called By</Label>
          <Input value={data.calledBy || ""} onChange={(e) => onChange({ calledBy: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Chair / Acting Trustee / Manager</Label>
          <Input value={data.chair || ""} onChange={(e) => onChange({ chair: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!data.title || !data.actionDate}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepParticipants({
  data,
  onChange,
  onBack,
  onNext,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [newParticipant, setNewParticipant] = useState<Partial<Participant>>({
    personName: "",
    role: "Trustee",
    present: true,
    votingPower: 1.0,
  });

  function addParticipant() {
    if (!newParticipant.personName) return;
    onChange({
      participants: [
        ...data.participants,
        {
          id: Date.now().toString(),
          personName: newParticipant.personName!,
          role: newParticipant.role || "Trustee",
          present: newParticipant.present ?? true,
          votingPower: newParticipant.votingPower || 1.0,
        },
      ],
    });
    setNewParticipant({ personName: "", role: "Trustee", present: true, votingPower: 1.0 });
  }

  function removeParticipant(id: string) {
    onChange({ participants: data.participants.filter((p) => p.id !== id) });
  }

  const presentCount = data.participants.filter((p) => p.present).length;
  const quorumMet = data.participants.length === 0 ? false : presentCount / data.participants.length >= 0.5;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Participants & Authority</h2>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Participant Name"
            value={newParticipant.personName || ""}
            onChange={(e) => setNewParticipant({ ...newParticipant, personName: e.target.value })}
            className="flex-1"
          />
          <Select value={newParticipant.role} onValueChange={(v) => setNewParticipant({ ...newParticipant, role: v })}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Trustee">Trustee</SelectItem>
              <SelectItem value="Manager">Manager</SelectItem>
              <SelectItem value="Director">Director</SelectItem>
              <SelectItem value="Officer">Officer</SelectItem>
              <SelectItem value="Member">Member</SelectItem>
              <SelectItem value="Consultant">Consultant</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addParticipant}>Add</Button>
        </div>
      </div>

      <div className="space-y-2">
        {data.participants.map((p) => (
          <div key={p.id} className="flex items-center gap-2 p-2 border rounded">
            <Checkbox
              checked={p.present}
              onCheckedChange={(checked) => {
                onChange({
                  participants: data.participants.map((part) =>
                    part.id === p.id ? { ...part, present: !!checked } : part
                  ),
                });
              }}
            />
            <span className="flex-1">{p.personName}</span>
            <Badge variant="outline">{p.role}</Badge>
            <Button variant="ghost" size="sm" onClick={() => removeParticipant(p.id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="p-3 border rounded bg-muted">
        <div className="flex items-center gap-2">
          {data.recordType === "written_consent" ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Quorum Not Required (Written Consent)</span>
            </>
          ) : quorumMet ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Quorum Met ({presentCount}/{data.participants.length} present)</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm">Quorum Not Met ({presentCount}/{data.participants.length} present)</span>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={data.participants.length === 0 || (data.recordType === "meeting" && !quorumMet)}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepAgenda({
  data,
  onChange,
  onBack,
  onNext,
}: {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [newItem, setNewItem] = useState({ title: "", description: "", actionTaken: false });

  function addAgendaItem() {
    if (!newItem.title) return;
    onChange({
      agendaItems: [
        ...data.agendaItems,
        {
          id: Date.now().toString(),
          ...newItem,
        },
      ],
    });
    setNewItem({ title: "", description: "", actionTaken: false });
  }

  function removeAgendaItem(id: string) {
    onChange({ agendaItems: data.agendaItems.filter((item) => item.id !== id) });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Agenda Items</h2>

      <div className="space-y-2">
        <Input
          placeholder="Agenda Item Title"
          value={newItem.title}
          onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
        />
        <Textarea
          placeholder="Description / Discussion Notes"
          value={newItem.description}
          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
        />
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={newItem.actionTaken}
            onCheckedChange={(checked) => setNewItem({ ...newItem, actionTaken: !!checked })}
          />
          <Label>Action Taken? (requires Resolution)</Label>
        </div>
        <Button onClick={addAgendaItem}>Add Agenda Item</Button>
      </div>

      <div className="space-y-2">
        {data.agendaItems.map((item) => (
          <div key={item.id} className="p-3 border rounded">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium">{item.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{item.description}</div>
                {item.actionTaken && <Badge className="mt-2">Requires Resolution</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeAgendaItem(item.id)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepResolutions({
  data,
  entityType,
  onChange,
  onBack,
  onNext,
}: {
  data: WizardData;
  entityType: string;
  onChange: (updates: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [editingResolution, setEditingResolution] = useState<Resolution | null>(null);
  const [newResolution, setNewResolution] = useState<Partial<Resolution>>({
    title: "",
    resolutionType: "Organizational",
    text: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    approvalThreshold: "Majority",
    isStanding: false,
  });

  function addResolution() {
    if (!newResolution.title || !newResolution.text || !newResolution.effectiveDate) return;

    // Check if template should be used
    if (newResolution.text === "" && entityType) {
      const template = getTemplateForResolution(entityType, newResolution.resolutionType || "Organizational");
      if (template) {
        newResolution.text = template({
          ENTITY_NAME: data.entityName || "Entity",
          ENTITY_TYPE: entityType,
          JURISDICTION: data.jurisdiction || "State",
          ACTION_DATE: data.actionDate,
          EFFECTIVE_DATE: newResolution.effectiveDate,
          CHAIR_OR_TRUSTEE: data.chair || "Trustee",
        } as any);
      }
    }

    onChange({
      resolutions: [
        ...data.resolutions,
        {
          id: Date.now().toString(),
          title: newResolution.title!,
          resolutionType: newResolution.resolutionType || "Organizational",
          text: newResolution.text!,
          effectiveDate: newResolution.effectiveDate!,
          expirationDate: newResolution.expirationDate,
          monetaryThreshold: newResolution.monetaryThreshold,
          counterparty: newResolution.counterparty,
          approvalThreshold: newResolution.approvalThreshold || "Majority",
          isStanding: newResolution.isStanding || false,
          standingScope: newResolution.standingScope,
        },
      ],
    });
    setNewResolution({
      title: "",
      resolutionType: "Organizational",
      text: "",
      effectiveDate: new Date().toISOString().slice(0, 10),
      approvalThreshold: "Majority",
      isStanding: false,
    });
  }

  function removeResolution(id: string) {
    onChange({ resolutions: data.resolutions.filter((r) => r.id !== id) });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Resolution Builder</h2>

      <div className="space-y-4 border rounded p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Resolution Title *</Label>
            <Input
              value={newResolution.title || ""}
              onChange={(e) => setNewResolution({ ...newResolution, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Resolution Type *</Label>
            <Select
              value={newResolution.resolutionType}
              onValueChange={(v) => setNewResolution({ ...newResolution, resolutionType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Organizational">Organizational</SelectItem>
                <SelectItem value="Banking">Banking</SelectItem>
                <SelectItem value="AssetAcquisition">Asset Acquisition</SelectItem>
                <SelectItem value="AssetSale">Asset Sale</SelectItem>
                <SelectItem value="ContractApproval">Contract Approval</SelectItem>
                <SelectItem value="TaxElection">Tax Election</SelectItem>
                <SelectItem value="OfficerAppointment">Officer Appointment</SelectItem>
                <SelectItem value="ManagerAppointment">Manager Appointment</SelectItem>
                <SelectItem value="DelegationOfAuthority">Delegation of Authority</SelectItem>
                <SelectItem value="StandingResolution">Standing Resolution</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Resolution Text *</Label>
          <Textarea
            value={newResolution.text || ""}
            onChange={(e) => setNewResolution({ ...newResolution, text: e.target.value })}
            className="min-h-[200px]"
            placeholder="Enter resolution text or use template..."
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const template = getTemplateForResolution(entityType, newResolution.resolutionType || "Organizational");
              if (template) {
                setNewResolution({
                  ...newResolution,
                  text: template({
                    ENTITY_NAME: data.entityName || "Entity",
                    ENTITY_TYPE: entityType,
                    JURISDICTION: data.jurisdiction || "State",
                    ACTION_DATE: data.actionDate,
                    EFFECTIVE_DATE: newResolution.effectiveDate || new Date().toISOString().slice(0, 10),
                    CHAIR_OR_TRUSTEE: data.chair || "Trustee",
                  } as any),
                });
              }
            }}
          >
            Use Template
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Effective Date *</Label>
            <Input
              type="date"
              value={newResolution.effectiveDate || ""}
              onChange={(e) => setNewResolution({ ...newResolution, effectiveDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Expiration Date (optional)</Label>
            <Input
              type="date"
              value={newResolution.expirationDate || ""}
              onChange={(e) => setNewResolution({ ...newResolution, expirationDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Monetary Threshold (optional)</Label>
            <Input
              type="number"
              value={newResolution.monetaryThreshold || ""}
              onChange={(e) => setNewResolution({ ...newResolution, monetaryThreshold: parseFloat(e.target.value) || undefined })}
            />
          </div>
          <div className="space-y-2">
            <Label>Counterparty (optional)</Label>
            <Input
              value={newResolution.counterparty || ""}
              onChange={(e) => setNewResolution({ ...newResolution, counterparty: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Approval Threshold</Label>
          <Select
            value={newResolution.approvalThreshold}
            onValueChange={(v) => setNewResolution({ ...newResolution, approvalThreshold: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Majority">Majority</SelectItem>
              <SelectItem value="Supermajority">Supermajority</SelectItem>
              <SelectItem value="Unanimous">Unanimous</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            checked={newResolution.isStanding}
            onCheckedChange={(checked) => setNewResolution({ ...newResolution, isStanding: !!checked })}
          />
          <Label>Is Standing Resolution?</Label>
        </div>

        <Button onClick={addResolution} disabled={!newResolution.title || !newResolution.text || !newResolution.effectiveDate}>
          Add Resolution
        </Button>
      </div>

      <div className="space-y-2">
        {data.resolutions.map((res) => (
          <div key={res.id} className="p-3 border rounded">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium">{res.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{res.resolutionType}</div>
                {res.isStanding && <Badge className="mt-2">Standing</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeResolution(res.id)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepExhibits({
  data,
  minutesId,
  onChange,
  onBack,
  onNext,
}: {
  data: WizardData;
  minutesId: string | null;
  onChange: (updates: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Exhibits & Attachments</h2>
      <p className="text-sm text-muted-foreground">
        Upload contracts, bank letters, deeds, tax forms, invoices, or schedules. File upload functionality will be implemented here.
      </p>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepReview({
  data,
  busy,
  onBack,
  onSave,
  onSubmit,
}: {
  data: WizardData;
  busy: boolean;
  onBack: () => void;
  onSave: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Review & Submit</h2>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <strong>Record Type:</strong> {data.recordType === "meeting" ? "Meeting Minutes" : "Written Consent"}
            </div>
            <div>
              <strong>Title:</strong> {data.title || "Untitled"}
            </div>
            <div>
              <strong>Date:</strong> {data.actionDate}
            </div>
            <div>
              <strong>Participants:</strong> {data.participants.length}
            </div>
            <div>
              <strong>Agenda Items:</strong> {data.agendaItems.length}
            </div>
            <div>
              <strong>Resolutions:</strong> {data.resolutions.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSave} disabled={busy}>
            Save Draft
          </Button>
          <Button onClick={onSubmit} disabled={busy || !data.title}>
            Submit for Approval
          </Button>
        </div>
      </div>
    </div>
  );
}
