"use client";

/**
 * Building Data Service
 *
 * Client-side building persistence + caching layer for OASIS buildings.
 *
 * Notes for this repo:
 * - Auth is cookie-based (`auth-token` httpOnly cookie). So fetch uses `credentials: "include"`.
 * - Server API routes live at `/api/buildings` + `/api/buildings/[id]`.
 */

import { useEffect, useState } from "react";
import { Building, type BuildingConfig } from "@/lib/BuildingSystem";

// ============================================================================
// Types
// ============================================================================

export interface BuildingRecord {
  id: string;
  userId: number;
  name: string;
  type: BuildingConfig["type"];
  description?: string | null;
  data: string; // JSON stringified building data
  thumbnail?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  version: number;
  isPublic: boolean;
  tags: string[] | string; // server stores as JSON string
  metadata?: Record<string, any> | string | null;
}

export interface BuildingVersion {
  id: string;
  buildingId: string;
  version: number;
  data: string;
  changesSummary: string;
  createdAt: Date;
  createdBy: string | number;
}

export interface BuildingChange {
  id: string;
  buildingId: string;
  type: "component_added" | "component_updated" | "component_removed" | "building_modified";
  componentId?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
  userId: string | number;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncError?: string;
}

export interface SearchQuery {
  name?: string;
  type?: BuildingConfig["type"];
  tags?: string[];
  isPublic?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Building Data Service
// ============================================================================

export class BuildingDataService {
  private apiUrl: string;
  private localStorageKey = "building_cache_v1";
  private syncStatusMap: Map<string, SyncStatus> = new Map();
  private changeLog: BuildingChange[] = [];
  private versionHistory: Map<string, BuildingVersion[]> = new Map();

  constructor(apiUrl: string = "/api") {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.initializeLocalStorage();
  }

  private initializeLocalStorage(): void {
    if (typeof window === "undefined") return;
    const cached = localStorage.getItem(this.localStorageKey);
    if (!cached) localStorage.setItem(this.localStorageKey, JSON.stringify({}));
  }

  private getCachedBuildings(): Map<string, BuildingRecord> {
    if (typeof window === "undefined") return new Map();
    const cached = localStorage.getItem(this.localStorageKey);
    if (!cached) return new Map();
    try {
      const data = JSON.parse(cached) as Record<string, BuildingRecord>;
      return new Map(Object.entries(data));
    } catch (error) {
      console.error("[BuildingDataService] Failed to parse cached buildings:", error);
      return new Map();
    }
  }

  private saveCachedBuildings(buildings: Map<string, BuildingRecord>): void {
    if (typeof window === "undefined") return;
    const data = Object.fromEntries(buildings);
    localStorage.setItem(this.localStorageKey, JSON.stringify(data));
  }

  private async fetchJson(input: RequestInfo | URL, init?: RequestInit) {
    const res = await fetch(input, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  async createBuilding(building: Building, isPublic: boolean = false): Promise<BuildingRecord> {
    const record = {
      id: building.id,
      name: building.name,
      type: building.type,
      description: `${building.numberOfFloors}-floor ${building.type}`,
      data: JSON.stringify(building.export()),
      version: 1,
      isPublic,
      tags: [building.type],
      metadata: {
        width: building.width,
        depth: building.depth,
        numberOfFloors: building.numberOfFloors,
        totalComponents: building.getTotalComponentCount(),
      },
    };

    const savedRecord: BuildingRecord = await this.fetchJson(`${this.apiUrl}/buildings`, {
      method: "POST",
      body: JSON.stringify(record),
    });

    const cached = this.getCachedBuildings();
    cached.set(savedRecord.id, savedRecord);
    this.saveCachedBuildings(cached);

    this.versionHistory.set(savedRecord.id, [
      {
        id: `${savedRecord.id}-v1`,
        buildingId: savedRecord.id,
        version: 1,
        data: savedRecord.data,
        changesSummary: "Initial creation",
        createdAt: new Date(),
        createdBy: "me",
      },
    ]);

    return savedRecord;
  }

  async getBuilding(buildingId: string): Promise<Building | null> {
    // cache first
    const cached = this.getCachedBuildings();
    const cachedRecord = cached.get(buildingId);
    if (cachedRecord) {
      try {
        return Building.import(JSON.parse(cachedRecord.data));
      } catch (error) {
        console.error("[BuildingDataService] Failed to parse cached building:", error);
      }
    }

    try {
      const record: BuildingRecord = await this.fetchJson(`${this.apiUrl}/buildings/${buildingId}`);
      cached.set(buildingId, record);
      this.saveCachedBuildings(cached);
      return Building.import(JSON.parse(record.data));
    } catch (error) {
      console.error("[BuildingDataService] Failed to get building:", error);
      return null;
    }
  }

  async updateBuilding(building: Building, changesSummary: string = ""): Promise<BuildingRecord> {
    const newData = JSON.stringify(building.export());

    const payload = {
      name: building.name,
      type: building.type,
      description: `${building.numberOfFloors}-floor ${building.type}`,
      data: newData,
      tags: [building.type],
      metadata: {
        width: building.width,
        depth: building.depth,
        numberOfFloors: building.numberOfFloors,
        totalComponents: building.getTotalComponentCount(),
      },
    };

    const updatedRecord: BuildingRecord = await this.fetchJson(`${this.apiUrl}/buildings/${building.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    // Update cache
    const cached = this.getCachedBuildings();
    cached.set(building.id, updatedRecord);
    this.saveCachedBuildings(cached);

    // Version history
    const versions = this.versionHistory.get(building.id) || [];
    versions.push({
      id: `${building.id}-v${updatedRecord.version}`,
      buildingId: building.id,
      version: updatedRecord.version,
      data: newData,
      changesSummary: changesSummary || "Building updated",
      createdAt: new Date(),
      createdBy: "me",
    });
    this.versionHistory.set(building.id, versions);

    return updatedRecord;
  }

  async deleteBuilding(buildingId: string): Promise<void> {
    await this.fetchJson(`${this.apiUrl}/buildings/${buildingId}`, { method: "DELETE" });

    const cached = this.getCachedBuildings();
    cached.delete(buildingId);
    this.saveCachedBuildings(cached);
    this.versionHistory.delete(buildingId);
  }

  async listBuildings(query: SearchQuery = {}): Promise<BuildingRecord[]> {
    const params = new URLSearchParams();
    if (query.name) params.append("name", query.name);
    if (query.type) params.append("type", query.type);
    if (query.isPublic !== undefined) params.append("isPublic", String(query.isPublic));
    if (query.tags?.length) params.append("tags", query.tags.join(","));
    if (query.limit) params.append("limit", String(query.limit));
    if (query.offset) params.append("offset", String(query.offset));

    const records: BuildingRecord[] = await this.fetchJson(`${this.apiUrl}/buildings?${params.toString()}`);

    const cached = this.getCachedBuildings();
    records.forEach((r) => cached.set(r.id, r));
    this.saveCachedBuildings(cached);
    return records;
  }

  trackChange(
    buildingId: string,
    type: BuildingChange["type"],
    componentId?: string,
    oldValue?: any,
    newValue?: any
  ): void {
    const change: BuildingChange = {
      id: `change-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      buildingId,
      type,
      componentId,
      oldValue,
      newValue,
      timestamp: new Date(),
      userId: "me",
    };
    this.changeLog.push(change);
    if (this.changeLog.length > 100) this.changeLog = this.changeLog.slice(-100);
  }

  getChangeLog(buildingId: string): BuildingChange[] {
    return this.changeLog.filter((c) => c.buildingId === buildingId);
  }

  getVersionHistory(buildingId: string): BuildingVersion[] {
    return this.versionHistory.get(buildingId) || [];
  }

  async exportBuilding(buildingId: string): Promise<string | null> {
    const building = await this.getBuilding(buildingId);
    if (!building) return null;
    return JSON.stringify(building.export(), null, 2);
  }

  async importBuilding(json: string): Promise<Building | null> {
    try {
      const data = JSON.parse(json);
      return Building.import(data);
    } catch (error) {
      console.error("[BuildingDataService] Failed to import building:", error);
      return null;
    }
  }

  async syncBuilding(buildingId: string): Promise<boolean> {
    try {
      this.syncStatusMap.set(buildingId, { isSyncing: true, lastSyncTime: null, pendingChanges: 0 });
      const building = await this.getBuilding(buildingId);
      if (!building) throw new Error("Building not found");
      await this.updateBuilding(building, "Synced with server");
      this.syncStatusMap.set(buildingId, { isSyncing: false, lastSyncTime: new Date(), pendingChanges: 0 });
      return true;
    } catch (error) {
      const prev = this.syncStatusMap.get(buildingId) || { isSyncing: false, lastSyncTime: null, pendingChanges: 0 };
      this.syncStatusMap.set(buildingId, { ...prev, isSyncing: false, syncError: String(error) });
      return false;
    }
  }

  getSyncStatus(buildingId: string): SyncStatus {
    return (
      this.syncStatusMap.get(buildingId) || {
        isSyncing: false,
        lastSyncTime: null,
        pendingChanges: 0,
      }
    );
  }

  clearCache(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.localStorageKey);
    this.changeLog = [];
    this.versionHistory.clear();
    this.syncStatusMap.clear();
    this.initializeLocalStorage();
  }
}

// ============================================================================
// Singleton + Hook
// ============================================================================

let buildingDataServiceInstance: BuildingDataService | null = null;

export function initializeBuildingDataService(apiUrl: string = "/api"): BuildingDataService {
  if (!buildingDataServiceInstance) buildingDataServiceInstance = new BuildingDataService(apiUrl);
  return buildingDataServiceInstance;
}

export function getBuildingDataService(): BuildingDataService {
  if (!buildingDataServiceInstance) throw new Error("BuildingDataService not initialized. Call initializeBuildingDataService first.");
  return buildingDataServiceInstance;
}

export function useBuildingDataService(apiUrl: string = "/api") {
  const [service, setService] = useState<BuildingDataService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const instance = initializeBuildingDataService(apiUrl);
    setService(instance);
    setIsInitialized(true);
  }, [apiUrl]);

  return { service, isInitialized };
}




