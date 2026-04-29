/**
 * Troo SDK - Platform API client
 * npm install troo-sdk
 *
 * const troo = new TrooClient({ apiKey: 'hf_live_xxx', baseUrl: 'https://app.example.com' });
 * const worlds = await troo.getWorlds();
 * troo.listen('world_published', (event) => console.log(event));
 */

export interface TrooClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface World {
  id: string;
  name: string;
  description?: string;
  visibility: string;
  terrainSeed: number;
  biomeType: string;
  status: string;
  ownerId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommerceNode {
  id: string;
  worldId: string;
  ownerId: number;
  nodeType: string;
  placementJson: unknown;
  title: string;
  description?: string;
  agentId?: string;
  priceToken?: number;
  priceUSD?: number;
  status: string;
}

export interface App {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  creatorId: number;
  version: number;
  priceToken?: number;
  priceUSD?: number;
  installCount: number;
  status: string;
}

export interface PlatformEvent {
  id: string;
  eventType: string;
  sourceModule: string;
  payload: Record<string, unknown>;
  trustId?: string;
  createdAt?: string;
}

export class TrooClient {
  private apiKey: string;
  private baseUrl: string;
  private eventSource: EventSource | null = null;

  constructor(options: TrooClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "https://app.troo.com")).replace(/\/$/, "");
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  /** List worlds (owned + public) */
  async getWorlds(scope?: "me" | "all"): Promise<{ data: World[]; meta: { count: number } }> {
    const q = scope ? `?scope=${scope}` : "";
    return this.fetch(`/api/v1/worlds${q}`);
  }

  /** Get world by ID */
  async getWorld(id: string): Promise<{ data: World }> {
    return this.fetch(`/api/v1/worlds/${id}`);
  }

  /** Get outgoing links from a world (network connectivity) */
  async getWorldLinks(worldId: string): Promise<{
    data: Array<{
      id: string;
      fromWorldId: string;
      toWorldId: string;
      label?: string;
      placementJson?: unknown;
    }>;
    meta: { count: number };
  }> {
    return this.fetch(`/api/v1/worlds/${worldId}/links`);
  }

  /** Add a link from one world to another (write:worlds, owner only) */
  async linkWorld(params: {
    fromWorldId: string;
    toWorldId: string;
    label?: string;
    placementJson?: unknown;
  }): Promise<{
    success: boolean;
    link: {
      id: string;
      fromWorldId: string;
      toWorldId: string;
      label?: string;
      placementJson?: unknown;
    };
  }> {
    return this.fetch(`/api/v1/worlds/${params.fromWorldId}/links`, {
      method: "POST",
      body: JSON.stringify({
        toWorldId: params.toWorldId,
        label: params.label,
        placementJson: params.placementJson,
      }),
    });
  }

  /** Get current user's Troo ID and linked wallets (requires read:worlds) */
  async getIdentity(): Promise<{
    data: {
      trooId: string;
      userId: number;
      wallets: Array<{ chain: string; address: string; verifiedAt?: string }>;
    };
  }> {
    return this.fetch("/api/v1/identity");
  }

  /** Link a wallet to Troo identity (requires write:worlds) */
  async linkWallet(params: { chain?: string; address: string }): Promise<{
    success: boolean;
    alreadyLinked?: boolean;
    wallet: { chain: string; address: string };
  }> {
    return this.fetch("/api/v1/identity/wallets", {
      method: "POST",
      body: JSON.stringify({
        chain: params.chain ?? "evm",
        address: params.address,
      }),
    });
  }

  /** List available platform agents (requires read:worlds or read:commerce) */
  async getAgents(): Promise<{
    data: Array<{
      id: string;
      slug: string;
      name: string;
      description?: string;
      capabilities?: unknown;
      priceToken?: number;
      priceUSD?: number;
    }>;
    meta: { count: number };
  }> {
    return this.fetch("/api/v1/agents");
  }

  /** Spawn an agent/NPC in a world (requires write:worlds, owner only) */
  async spawnAgent(params: {
    worldId: string;
    agentId?: string;
    position?: [number, number, number];
    role?: string;
    voiceProfile?: string;
  }): Promise<{
    success: boolean;
    npc: {
      id: string;
      worldId: string;
      agentId: string;
      placementJson: unknown;
      role?: string;
      voiceProfile?: string;
    };
  }> {
    const placementJson = params.position
      ? { position: params.position, rotation: [0, 0, 0], scale: [1, 1, 1] }
      : undefined;
    return this.fetch(`/api/v1/worlds/${params.worldId}/npcs`, {
      method: "POST",
      body: JSON.stringify({
        agentId: params.agentId ?? "default",
        placementJson,
        role: params.role,
        voiceProfile: params.voiceProfile,
      }),
    });
  }

  /** Create a world */
  async createWorld(params: { name: string; description?: string }): Promise<{ world: World }> {
    return this.fetch("/api/worlds", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /** Get commerce nodes for a world */
  async getCommerce(worldId: string): Promise<{ data: CommerceNode[]; meta: { count: number } }> {
    return this.fetch(`/api/v1/worlds/${worldId}/commerce`);
  }

  /** Get transactions for a commerce node (requires read:commerce, owner only) */
  async getCommerceTransactions(
    worldId: string,
    nodeId: string
  ): Promise<{
    data: Array<{
      id: string;
      payerId: number;
      amountToken?: number;
      amountUSD?: number;
      ownerAmountToken?: number;
      ownerAmountUSD?: number;
      status: string;
      createdAt?: string;
    }>;
    meta: { count: number; totalOwnerToken: number; totalOwnerUSD: number };
  }> {
    return this.fetch(`/api/v1/worlds/${worldId}/commerce/${nodeId}/transactions`);
  }

  /** Record a commerce transaction (requires write:commerce scope) */
  async transact(params: {
    worldId: string;
    nodeId: string;
    amountToken?: number;
    amountUSD?: number;
    txRef?: string;
  }): Promise<{
    success: boolean;
    transaction: {
      id: string;
      worldId: string;
      nodeId: string;
      payerId: number;
      payeeId: number;
      amountToken: number;
      amountUSD: number;
      platformFeeToken: number;
      platformFeeUSD: number;
      ownerAmountToken: number;
      ownerAmountUSD: number;
      status: string;
    };
  }> {
    return this.fetch(
      `/api/v1/worlds/${params.worldId}/commerce/${params.nodeId}/transact`,
      {
        method: "POST",
        body: JSON.stringify({
          amountToken: params.amountToken ?? 0,
          amountUSD: params.amountUSD ?? 0,
          txRef: params.txRef,
        }),
      }
    );
  }

  /** List apps */
  async getApps(scope?: "my" | "public", category?: string): Promise<{ data: App[]; meta: { count: number } }> {
    const params = new URLSearchParams();
    if (scope) params.set("scope", scope);
    if (category) params.set("category", category);
    const q = params.toString() ? `?${params}` : "";
    return this.fetch(`/api/v1/apps${q}`);
  }

  /** Get app by slug */
  async getApp(slug: string): Promise<{ data: App }> {
    return this.fetch(`/api/v1/apps/${slug}`);
  }

  /** List world library assets (requires read:assets) */
  async getWorldAssets(category?: string): Promise<{
    data: Array<{
      id: string;
      slug: string;
      name: string;
      category: string;
      description?: string;
      tokenPrice: number;
      modelUrl: string;
      previewImageUrl?: string;
    }>;
    meta: { count: number };
  }> {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    return this.fetch(`/api/v1/world-assets${q}`);
  }

  /** Create a commerce node to sell in a world (requires write:commerce, owner only) */
  async sellAsset(params: {
    worldId: string;
    title: string;
    nodeType?: "store" | "product_display" | "service" | "consultation";
    position?: [number, number, number];
    priceToken?: number;
    priceUSD?: number;
    assetId?: string;
    description?: string;
  }): Promise<{
    success: boolean;
    node: {
      id: string;
      worldId: string;
      ownerId: number;
      nodeType: string;
      title: string;
      status: string;
    };
  }> {
    const placementJson = params.position
      ? { position: params.position, rotation: [0, 0, 0], scale: [1, 1, 1] }
      : undefined;
    return this.fetch(`/api/v1/worlds/${params.worldId}/commerce`, {
      method: "POST",
      body: JSON.stringify({
        nodeType: params.nodeType ?? "product_display",
        title: params.title,
        placementJson,
        priceToken: params.priceToken,
        priceUSD: params.priceUSD,
        assetId: params.assetId,
        description: params.description,
      }),
    });
  }

  /** Purchase a world library asset (requires write:assets) */
  async purchaseAsset(params: {
    assetId: string;
    worldId?: string;
    licenseScope?: "all_worlds_owned" | "one_world" | "quantity_based";
    txRef?: string;
  }): Promise<{
    success: boolean;
    alreadyOwned: boolean;
    ownershipId: string;
    assetId: string;
    licenseScope: string;
    tokenPrice?: number;
  }> {
    return this.fetch(`/api/v1/world-assets/${params.assetId}/purchase`, {
      method: "POST",
      body: JSON.stringify({
        worldId: params.worldId,
        licenseScope: params.licenseScope,
        txRef: params.txRef,
      }),
    });
  }

  /** Install an app */
  async installApp(params: { appId?: string; slug?: string; scope: string; worldId?: string; entityId?: string }): Promise<{ success: boolean; installed: string }> {
    return this.fetch("/api/apps/install", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /** Listen to platform events (SSE). Returns unsubscribe function.
   * Note: EventSource cannot send Authorization header; use token query param for API key auth.
   * @param eventType - Filter to specific event type (e.g. 'world_published'), or null for all
   * @param callback - Called for each event
   * @param options - { scope: 'public' } for platform-wide public events (world_published, app_published, etc.) */
  listen(
    eventType: string | null,
    callback: (event: PlatformEvent) => void,
    options?: { scope?: "me" | "public" }
  ): () => void {
    const params = new URLSearchParams();
    params.set("token", this.apiKey);
    if (eventType) params.set("eventType", eventType);
    if (options?.scope === "public") params.set("scope", "public");
    const url = `${this.baseUrl}/api/v1/events/stream?${params.toString()}`;
    const es = new EventSource(url, { withCredentials: true });
    this.eventSource = es;

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as PlatformEvent;
        if (!eventType || data.eventType === eventType) {
          callback(data);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onmessage = handler;

    return () => {
      es.close();
      this.eventSource = null;
    };
  }
}
