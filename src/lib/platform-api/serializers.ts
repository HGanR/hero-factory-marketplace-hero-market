/**
 * Platform API Resource Serializers
 * Stable, versioned resource shapes (not raw DB dumps)
 */

export interface PlatformResource {
  id: string;
  type: string;
  metadata: Record<string, unknown>;
  relationships?: Record<string, string[]>;
  createdAt?: string;
  updatedAt?: string;
}

export function serializeTrust(row: Record<string, unknown>): PlatformResource {
  return {
    id: String(row.id),
    type: "trust",
    metadata: {
      name: row.name,
      firmName: row.firmName,
      status: row.status,
      trustType: row.trustType,
      trustCategory: row.trustCategory,
      moduleType: row.moduleType,
      publicId: row.publicId,
    },
    relationships: {},
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  };
}

export function serializeAsset(row: Record<string, unknown>): PlatformResource {
  return {
    id: String(row.id),
    type: "asset",
    metadata: {
      name: row.name,
      type: row.type,
      identifier: row.identifier,
      valuationUSD: row.valuationUSD,
      status: row.status,
      trustId: row.trustId,
    },
    relationships: { trust: row.trustId ? [String(row.trustId)] : [] },
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  };
}

export function serializeInstrument(row: Record<string, unknown>): PlatformResource {
  const relationships: Record<string, string[]> = { trust: [String(row.trustId ?? "")] };
  if (row.collateralPoolId) relationships.collateralPool = [String(row.collateralPoolId)];
  return {
    id: String(row.id),
    type: "instrument",
    metadata: {
      instrumentKind: row.instrumentKind,
      status: row.status,
      faceValue: row.faceValue ? Number(row.faceValue) : null,
      currency: row.currency ?? "USD",
      issueDate: row.issueDate ? String(row.issueDate).slice(0, 10) : null,
      maturityDate: row.maturityDate ? String(row.maturityDate).slice(0, 10) : null,
      serialNumber: row.serialNumber,
      trustId: row.trustId,
    },
    relationships,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  };
}

export function serializeEvent(row: Record<string, unknown>): PlatformResource {
  return {
    id: String(row.id),
    type: "event",
    metadata: {
      eventType: row.eventType,
      sourceModule: row.sourceModule,
      payload: row.payload,
      trustId: row.trustId,
    },
    relationships: row.trustId ? { trust: [String(row.trustId)] } : {},
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
  };
}

export function serializeWorkflow(row: Record<string, unknown>): PlatformResource {
  return {
    id: String(row.id),
    type: "workflow",
    metadata: {
      name: row.name,
      triggerEvent: row.triggerEvent,
      isActive: row.isActive,
      runCount: row.runCount,
      lastRunAt: row.lastRunAt instanceof Date ? row.lastRunAt.toISOString() : row.lastRunAt,
    },
    relationships: {},
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ""),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  };
}
