/** Shared DTO types for Skipper voice-operational read tools. */

export type IdentityLinkStatus = "approved" | "pending" | "unlinked" | "visitor";

export type JarvaActivityRow = {
  sessionId: string;
  accountDisplayName: string;
  identityStatus: IdentityLinkStatus;
  timestamp: string;
  conversationSummary: string;
  userRequestExcerpts: string[];
  jarvaWorkflowPath: string | null;
  marketplaceUserId: number | null;
};

export type RealityActivityRow = {
  conversationId: string;
  userDisplayName: string;
  identityStatus: IdentityLinkStatus;
  timestamp: string;
  conversationSummary: string;
  ownerUserId: number | null;
  visitorId: string | null;
};

export type ExecutiveInboxMessageRow = {
  messageId: string;
  senderName: string;
  subjectOrPreview: string;
  receivedAt: string;
  hasAttachment: boolean;
  hasAudioAttachment: boolean;
  firstAudioAttachmentId: string | null;
  attachmentCount: number;
};

export type NewRegistrationRow = {
  userId: number;
  accountDisplayName: string;
  createdAt: string;
  emailMasked: string;
  phoneAvailable: boolean;
  isApproved: boolean;
};

export type RegistrationPhoneQueueEntry = {
  userId: number;
  accountDisplayName: string;
  phone: string;
  createdAt: string;
};

export type InboxAudioPlayPayload = {
  messageId: string;
  attachmentId: string;
  url: string;
  filename: string;
  mimeType: string;
};

export type VoiceOperationalSnapshot = {
  generatedAt: string;
  jarva: JarvaActivityRow[];
  reality: RealityActivityRow[];
  inbox: ExecutiveInboxMessageRow[];
  registrations: NewRegistrationRow[];
  visitorsToday: number | null;
};
