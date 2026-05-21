/** Client-safe + API DTOs for WEBSITE delivery workspace. */

export type ClientDeliveryStatus =
  | "not_sent"
  | "workspace_active"
  | "client_approved"
  | "client_revision_requested";

export type DeliveryTokenStatus = "active" | "revoked" | "expired";

export type DeliveryTimelineEntryDto = {
  id: string;
  label: string;
  occurredAt: string;
  actorType: string | null;
  detail: string | null;
};

export type DeliveryTokenSummaryDto = {
  id: string;
  tokenPrefix: string;
  draftVersion: number;
  status: DeliveryTokenStatus;
  expiresAt: string;
  createdAt: string;
  lastAccessedAt: string | null;
};

export type ClientDeliveryAdminDto = {
  status: ClientDeliveryStatus;
  draftVersion: number;
  canGenerateLink: boolean;
  activeWorkspaceUrl: string | null;
  tokens: DeliveryTokenSummaryDto[];
  timeline: DeliveryTimelineEntryDto[];
};

export type ClientDeliveryWorkspaceDto = {
  ok: true;
  draftVersion: number;
  deliveryStatus: ClientDeliveryStatus;
  businessSummary: string | null;
  websiteGoals: string[];
  readinessSummary: string | null;
  readinessTier: string | null;
  draftPreview: {
    title: string | null;
    priority: string | null;
    previewText: string | null;
  };
  timeline: DeliveryTimelineEntryDto[];
  canApprove: boolean;
  canRequestRevision: boolean;
  expiresAt: string;
};
