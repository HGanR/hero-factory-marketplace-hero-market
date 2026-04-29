"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code2, Zap, Webhook, FileJson } from "lucide-react";

const EVENTS = [
  {
    id: "certificate_issued",
    label: "Certificate Issued",
    source: "Securities Module",
    lifecycle: "Entity → Instrument → Certificate",
    schema: {
      trustId: "string",
      certificateId: "string",
      offeringId: "string",
      amount: "string",
    },
    example: {
      event: "certificate_issued",
      payload: {
        trustId: "abc-123",
        certificateId: "cert-456",
        offeringId: "off-789",
        amount: "10000",
      },
      timestamp: "2025-03-12T12:00:00.000Z",
      deliveryId: "del_abc123",
    },
  },
  {
    id: "instrument_issued",
    label: "Instrument Issued",
    source: "Trust Records",
    lifecycle: "Entity → Instrument",
    schema: {
      trustId: "string",
      instrumentId: "string",
      instrumentKind: "string",
      faceValue: "number",
      currency: "string",
      issueDate: "string",
      maturityDate: "string?",
    },
    example: {
      event: "instrument_issued",
      payload: {
        trustId: "abc-123",
        instrumentId: "inst-456",
        instrumentKind: "Note",
        faceValue: 50000,
        currency: "USD",
        issueDate: "2025-03-12",
      },
      timestamp: "2025-03-12T12:00:00.000Z",
      deliveryId: "del_abc123",
    },
  },
  {
    id: "collateral_pledged",
    label: "Collateral Pledged",
    source: "Trust Records",
    lifecycle: "Instrument → Collateral Pool",
    schema: {
      trustId: "string",
      instrumentId: "string",
      assetId: "string",
      collateralPoolId: "string",
      pledgedValue: "number",
      lienPosition: "number?",
    },
    example: {
      event: "collateral_pledged",
      payload: {
        trustId: "abc-123",
        instrumentId: "inst-456",
        assetId: "asset-789",
        collateralPoolId: "pool-101",
        pledgedValue: 75000,
      },
      timestamp: "2025-03-12T12:00:00.000Z",
      deliveryId: "del_abc123",
    },
  },
  {
    id: "proceeds_received",
    label: "Proceeds Received",
    source: "Trust Records / Accounting",
    lifecycle: "Instrument → Funding",
    schema: {
      trustId: "string",
      instrumentId: "string",
      amount: "number",
      date: "string",
    },
    example: {
      event: "proceeds_received",
      payload: {
        trustId: "abc-123",
        instrumentId: "inst-456",
        amount: 50000,
        date: "2025-03-12",
      },
      timestamp: "2025-03-12T12:00:00.000Z",
      deliveryId: "del_abc123",
    },
  },
  {
    id: "entity_created",
    label: "Entity Created",
    source: "Entity Builder",
    lifecycle: "Entity",
    schema: {
      trustId: "string",
      workspaceId: "string",
      entityName: "string",
    },
    example: {
      event: "entity_created",
      payload: {
        trustId: "abc-123",
        workspaceId: "ws-456",
        entityName: "Acme Holdings LLC",
      },
      timestamp: "2025-03-12T12:00:00.000Z",
      deliveryId: "del_abc123",
    },
  },
  {
    id: "accounting_event_processed",
    label: "Accounting Event Processed",
    source: "Accounting Bridge",
    lifecycle: "Accounting",
    schema: {
      trustId: "string",
      sourceEventType: "string",
      sourceEventId: "string?",
      instrumentId: "string?",
      assetId: "string?",
    },
    example: {
      event: "accounting_event_processed",
      payload: {
        trustId: "abc-123",
        sourceEventType: "INSTRUMENT_ISSUED",
        instrumentId: "inst-456",
      },
      timestamp: "2025-03-12T12:00:00.000Z",
      deliveryId: "del_abc123",
    },
  },
  {
    id: "world_draft_saved",
    label: "World Draft Saved",
    source: "Worlds",
    lifecycle: "World Editor → Draft",
    schema: {
      worldId: "string",
      versionId: "string",
      chunkCount: "number",
    },
    example: {
      event: "world_draft_saved",
      payload: {
        worldId: "world-abc-123",
        versionId: "ver-456",
        chunkCount: 3,
      },
      timestamp: "2025-03-12T12:00:00.000Z",
      deliveryId: "del_abc123",
    },
  },
  {
    id: "world_published",
    label: "World Published",
    source: "Worlds",
    lifecycle: "Draft → Published",
    schema: {
      worldId: "string",
      worldName: "string",
      versionId: "string",
      chunkCount: "number",
    },
    example: {
      event: "world_published",
      payload: {
        worldId: "world-abc-123",
        worldName: "My World",
        versionId: "ver-789",
        chunkCount: 3,
      },
      timestamp: "2025-03-12T12:00:00.000Z",
      deliveryId: "del_abc123",
    },
  },
];

export default function EventRegistryPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) {
        router.push("/");
      }
    } catch {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <FileJson className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Event Registry</h1>
              <p className="text-slate-400">Platform events, payload schemas, and integration documentation</p>
            </div>
          </div>
        </div>

        <div className="mb-8 p-6 rounded-2xl border border-slate-800 bg-slate-950/50">
          <h2 className="text-lg font-semibold mb-4">Lifecycle</h2>
          <p className="text-slate-400 text-sm mb-4">
            Events follow the economic lifecycle of entities, instruments, and certificates:
          </p>
          <div className="font-mono text-sm text-cyan-300 space-y-1">
            <div>Entity Created → Assets Registered → Instrument Issued → Certificate Issued</div>
            <div>→ Proceeds Received → Accounting Event Processed</div>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/developers" className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1">
            ← Developer Portal
          </Link>
          <Link href="/platform/events" className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1">
            Platform Activity Stream →
          </Link>
          <Link href="/workflows" className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1">
            Workflow Automations →
          </Link>
        </div>

        <div className="space-y-8">
          {EVENTS.map((ev) => (
            <div
              key={ev.id}
              className="p-6 rounded-2xl border border-slate-800 bg-slate-950/50 hover:border-slate-700"
            >
              <div className="flex items-center gap-2 mb-2">
                <code className="text-cyan-300 font-mono font-semibold">{ev.id}</code>
                <span className="text-slate-500 text-sm">· {ev.source}</span>
              </div>
              <h3 className="text-lg font-semibold mb-1">{ev.label}</h3>
              <p className="text-slate-400 text-sm mb-4">{ev.lifecycle}</p>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Workflow Trigger
                  </h4>
                  <p className="text-xs text-slate-500 mb-2">Use this event in Workflow Automations</p>
                  <pre className="p-3 rounded-lg bg-slate-900 text-cyan-300 text-xs overflow-x-auto">
                    {JSON.stringify(ev.schema, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <Webhook className="w-4 h-4" />
                    Webhook Payload
                  </h4>
                  <p className="text-xs text-slate-500 mb-2">
                    Headers: X-Webhook-Event, X-Webhook-Delivery-Id, X-Webhook-Timestamp, X-Webhook-Signature
                  </p>
                  <pre className="p-3 rounded-lg bg-slate-900 text-amber-200 text-xs overflow-x-auto">
                    {JSON.stringify(ev.example, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-xs text-slate-400">
                  <strong>Signature verification:</strong> X-Webhook-Signature header is HMAC-SHA256 of raw body with your webhook secret.
                  Format: <code className="text-cyan-300">sha256=&lt;hex&gt;</code>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
