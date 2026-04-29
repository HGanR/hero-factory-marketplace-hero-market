export type StarFleetEntityStatus = "pending" | "active" | "closed";

export type StarFleetEntity = {
  id: string;
  name: string;
  jurisdiction: string;
  status: StarFleetEntityStatus;
  businessPurpose?: string;
  walletAddress?: string;
  createdAt: string; // ISO string
};

export type StarFleetDocumentCategory =
  | "operating_agreement"
  | "articles"
  | "contract"
  | "tax"
  | "compliance"
  | "other";

export type StarFleetDocument = {
  id: string;
  entityId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category: StarFleetDocumentCategory;
  uploadedAt: string; // ISO
  /**
   * Data URL (base64) for demo-only storage.
   * Note: localStorage is limited; we enforce size limits in the UI.
   */
  dataUrl: string;
};

export type StarFleetBlockchain = "xrp" | "polygon" | "ethereum" | "base";

export type StarFleetDeployment = {
  entityId: string;
  blockchain: StarFleetBlockchain;
  network: "testnet" | "mainnet";
  ownerAddress?: string;
  contractAddress: string;
  transactionHash: string;
  deployedAt: string; // ISO
};

export type StarFleetPluginType =
  | "token_minting"
  | "entity_wallet"
  | "ens"
  | "document_signing"
  | "member_management"
  | "otogo";

export type StarFleetPluginInstall = {
  id: string;
  entityId: string;
  pluginType: StarFleetPluginType;
  status: "active" | "inactive";
  installedAt: string; // ISO
};

const ENTITIES_KEY = "starfleet_entities_v1";
const DOCS_KEY = "starfleet_documents_v1";
const DEPLOYMENTS_KEY = "starfleet_deployments_v1";
const PLUGINS_KEY = "starfleet_plugins_v1";

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function loadStarFleetEntities(): StarFleetEntity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ENTITIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StarFleetEntity[];
  } catch {
    return [];
  }
}

export function saveStarFleetEntities(entities: StarFleetEntity[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENTITIES_KEY, JSON.stringify(entities));
}

export function createStarFleetEntity(input: Omit<StarFleetEntity, "id" | "createdAt" | "status"> & { status?: StarFleetEntityStatus }) {
  const entities = loadStarFleetEntities();
  const now = new Date().toISOString();
  const id = makeId("ent");
  const next: StarFleetEntity = {
    id,
    createdAt: now,
    status: input.status ?? "pending",
    name: input.name,
    jurisdiction: input.jurisdiction,
    businessPurpose: input.businessPurpose,
    walletAddress: input.walletAddress,
  };
  const updated = [next, ...entities];
  saveStarFleetEntities(updated);
  return next;
}

export function getStarFleetEntityById(id: string) {
  const entities = loadStarFleetEntities();
  return entities.find((e) => e.id === id) || null;
}

export function updateStarFleetEntity(id: string, patch: Partial<Omit<StarFleetEntity, "id" | "createdAt">>) {
  const entities = loadStarFleetEntities();
  const updated = entities.map((e) => (e.id === id ? { ...e, ...patch } : e));
  saveStarFleetEntities(updated);
  return updated.find((e) => e.id === id) ?? null;
}

// -----------------------------
// Documents (demo localStorage)
// -----------------------------

export function loadStarFleetDocuments(): StarFleetDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StarFleetDocument[];
  } catch {
    return [];
  }
}

export function saveStarFleetDocuments(docs: StarFleetDocument[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

export function listStarFleetDocumentsByEntity(entityId: string) {
  return loadStarFleetDocuments()
    .filter((d) => d.entityId === entityId)
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
}

export function createStarFleetDocument(input: Omit<StarFleetDocument, "id" | "uploadedAt">) {
  const docs = loadStarFleetDocuments();
  const next: StarFleetDocument = {
    ...input,
    id: makeId("doc"),
    uploadedAt: new Date().toISOString(),
  };
  const updated = [next, ...docs];
  saveStarFleetDocuments(updated);
  return next;
}

export function deleteStarFleetDocument(docId: string) {
  const docs = loadStarFleetDocuments();
  const updated = docs.filter((d) => d.id !== docId);
  saveStarFleetDocuments(updated);
}

// -----------------------------
// Blockchain deployments (demo)
// -----------------------------

export function loadStarFleetDeployments(): StarFleetDeployment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEPLOYMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StarFleetDeployment[];
  } catch {
    return [];
  }
}

export function saveStarFleetDeployments(deployments: StarFleetDeployment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEPLOYMENTS_KEY, JSON.stringify(deployments));
}

export function getStarFleetDeployment(entityId: string) {
  const deployments = loadStarFleetDeployments();
  return deployments.find((d) => d.entityId === entityId) ?? null;
}

function mockEvmAddress() {
  const hex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `0x${hex}`;
}

function mockTxHash() {
  const hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `0x${hex}`;
}

export function deployStarFleetEntity(input: Omit<StarFleetDeployment, "contractAddress" | "transactionHash" | "deployedAt">) {
  const deployments = loadStarFleetDeployments();
  const next: StarFleetDeployment = {
    ...input,
    contractAddress: input.blockchain === "xrp" ? `r${Math.random().toString(36).slice(2, 28)}` : mockEvmAddress(),
    transactionHash: mockTxHash(),
    deployedAt: new Date().toISOString(),
  };
  const updated = [next, ...deployments.filter((d) => d.entityId !== input.entityId)];
  saveStarFleetDeployments(updated);
  return next;
}

// -----------------------------
// Plugins (demo)
// -----------------------------

export function loadStarFleetPlugins(): StarFleetPluginInstall[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLUGINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StarFleetPluginInstall[];
  } catch {
    return [];
  }
}

export function saveStarFleetPlugins(installs: StarFleetPluginInstall[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLUGINS_KEY, JSON.stringify(installs));
}

export function listStarFleetPluginsByEntity(entityId: string) {
  return loadStarFleetPlugins()
    .filter((p) => p.entityId === entityId)
    .sort((a, b) => (a.installedAt < b.installedAt ? 1 : -1));
}

export function installStarFleetPlugin(entityId: string, pluginType: StarFleetPluginType) {
  const installs = loadStarFleetPlugins();
  const now = new Date().toISOString();
  const existing = installs.find((p) => p.entityId === entityId && p.pluginType === pluginType);
  if (existing) {
    const updated = installs.map((p) =>
      p.id === existing.id ? { ...p, status: "active" as const, installedAt: now } : p
    );
    saveStarFleetPlugins(updated);
    return updated.find((p) => p.id === existing.id) ?? null;
  }
  const next: StarFleetPluginInstall = {
    id: makeId("plugin"),
    entityId,
    pluginType,
    status: "active",
    installedAt: now,
  };
  const updated = [next, ...installs];
  saveStarFleetPlugins(updated);
  return next;
}

export function deactivateStarFleetPlugin(pluginInstallId: string) {
  const installs = loadStarFleetPlugins();
  const updated = installs.map((p) =>
    p.id === pluginInstallId ? { ...p, status: "inactive" as const } : p
  );
  saveStarFleetPlugins(updated);
}


