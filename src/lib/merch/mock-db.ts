import type { JobStatus, JobType } from "@/lib/jobs/types";

export type Lane = "CREATE" | "STUDIO";
export type VersionKind = "GENERATE" | "INPAINT" | "VARIANT";
export type RenderKind = "MOCKUP_FRONT" | "MOCKUP_BACK" | "FLAT" | "LIFESTYLE";
export type AssetType = "GARMENT_TEMPLATE" | "LOGO" | "REFERENCE" | "BRAND_KIT" | "MASK";
export type ExportType = "MOCKUP_PACK_ZIP" | "TECHPACK_PDF";
export type OrderStatus = "DRAFT" | "PAID" | "FULFILLING" | "SHIPPED" | "CANCELED";

export type ProjectRecord = {
  id: string;
  ownerId: string;
  lane: Lane;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type VersionRecord = {
  id: string;
  projectId: string;
  kind: VersionKind;
  prompt?: string;
  negativePrompt?: string;
  seed?: number;
  modelVersion?: string;
  paramsJson?: Record<string, unknown>;
  createdAt: string;
};

export type RenderRecord = {
  id: string;
  versionId: string;
  kind: RenderKind;
  width: number;
  height: number;
  url: string;
  metadataJson?: Record<string, unknown>;
  createdAt: string;
};

export type AssetRecord = {
  id: string;
  ownerId: string;
  type: AssetType;
  name: string;
  url: string;
  metadataJson?: Record<string, unknown>;
  createdAt: string;
};

export type ExportRecord = {
  id: string;
  projectId: string;
  type: ExportType;
  url: string;
  createdAt: string;
};

export type OrderRecord = {
  id: string;
  ownerId: string;
  projectId: string;
  status: OrderStatus;
  itemsJson: Array<Record<string, unknown>>;
  totalCents: number;
  createdAt: string;
};

export type JobRecord = {
  id: string;
  type: JobType;
  status: JobStatus;
  inputJson: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type MerchMemoryStore = {
  projects: ProjectRecord[];
  versions: VersionRecord[];
  renders: RenderRecord[];
  assets: AssetRecord[];
  exports: ExportRecord[];
  orders: OrderRecord[];
  jobs: JobRecord[];
};

const nowIso = () => new Date().toISOString();

const initialStore = (): MerchMemoryStore => ({
  projects: [],
  versions: [],
  renders: [],
  assets: [
    {
      id: "tee_black_front_template_asset_id",
      ownerId: "demo-owner",
      type: "GARMENT_TEMPLATE",
      name: "Tee Black Front Template",
      url: "/api/mock/garments/tee-black-front",
      metadataJson: { placementDefault: "CENTER_CHEST", scene: "front" },
      createdAt: nowIso(),
    },
  ],
  exports: [],
  orders: [],
  jobs: [],
});

const globalStore = globalThis as typeof globalThis & { __merchStore?: MerchMemoryStore };
if (!globalStore.__merchStore) {
  globalStore.__merchStore = initialStore();
}

export const merchStore = globalStore.__merchStore;

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

export function updateTimestamp<T extends { updatedAt?: string }>(value: T): T {
  value.updatedAt = nowIso();
  return value;
}

export function makeMockImageDataUrl(label: string, colorHex = "#111827") {
  const safeLabel = label.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="${colorHex}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f8fafc" font-size="52" font-family="Arial, sans-serif">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

