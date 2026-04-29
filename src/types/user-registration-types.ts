/**
 * User Registration System - TypeScript Interfaces
 *
 * Complete type definitions for all data structures used in the user registration,
 * authentication, and account management system.
 */

// =============================================================================
// ENUMS
// =============================================================================

/** Entity types for business registration */
export enum EntityType {
  INDIVIDUAL = "INDIVIDUAL",
  LLC = "LLC",
  CORP = "CORP",
  TRUST = "TRUST",
  PARTNERSHIP = "PARTNERSHIP",
  S_CORP = "S_CORP",
  NONPROFIT = "NONPROFIT",
  OTHER = "OTHER",
}

/** User account status */
export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING_PASSWORD_CHANGE = "PENDING_PASSWORD_CHANGE",
  ARCHIVED = "ARCHIVED",
}

/** Registration status */
export enum RegistrationStatus {
  PENDING_ADMIN_APPROVAL = "PENDING_ADMIN_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SUSPENDED = "SUSPENDED",
  ARCHIVED = "ARCHIVED",
}

/** Password reset token types */
export enum TokenType {
  PASSWORD_RESET = "PASSWORD_RESET",
  INITIAL_PASSWORD = "INITIAL_PASSWORD",
  EMAIL_VERIFICATION = "EMAIL_VERIFICATION",
}

/** Token status */
export enum TokenStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

/** Admin approval actions */
export enum ApprovalAction {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SUSPENDED = "SUSPENDED",
  REACTIVATED = "REACTIVATED",
}

/** Audit log actions */
export enum AuditAction {
  REGISTRATION_SUBMITTED = "REGISTRATION_SUBMITTED",
  REGISTRATION_APPROVED = "REGISTRATION_APPROVED",
  REGISTRATION_REJECTED = "REGISTRATION_REJECTED",
  PASSWORD_GENERATED = "PASSWORD_GENERATED",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED",
  USER_LOGIN = "USER_LOGIN",
  LOGIN_FAILED = "LOGIN_FAILED",
  ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED",
  ACCOUNT_REACTIVATED = "ACCOUNT_REACTIVATED",
  EMAIL_SENT = "EMAIL_SENT",
  EMAIL_FAILED = "EMAIL_FAILED",
  PROFILE_UPDATED = "PROFILE_UPDATED",
  PERMISSIONS_CHANGED = "PERMISSIONS_CHANGED",
}

/** User roles */
export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
  MODERATOR = "moderator",
}

/** User permissions */
export enum UserPermission {
  READ_OWN_DOCUMENTS = "read:own_documents",
  WRITE_OWN_DOCUMENTS = "write:own_documents",
  DELETE_OWN_DOCUMENTS = "delete:own_documents",
  READ_ALL_DOCUMENTS = "read:all_documents",
  WRITE_ALL_DOCUMENTS = "write:all_documents",
  DELETE_ALL_DOCUMENTS = "delete:all_documents",
  MANAGE_USERS = "manage:users",
  MANAGE_REGISTRATIONS = "manage:registrations",
  VIEW_AUDIT_LOGS = "view:audit_logs",
  MANAGE_PERMISSIONS = "manage:permissions",
}

/** Verification methods */
export enum VerificationMethod {
  MANUAL_REVIEW = "MANUAL_REVIEW",
  AUTOMATED_CHECK = "AUTOMATED_CHECK",
  PHONE_VERIFICATION = "PHONE_VERIFICATION",
  DOCUMENT_VERIFICATION = "DOCUMENT_VERIFICATION",
  THIRD_PARTY_VERIFICATION = "THIRD_PARTY_VERIFICATION",
}

// =============================================================================
// INPUT / REQUEST INTERFACES
// =============================================================================

export interface RegistrationRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  entityId: string;
  entityName: string;
  entityType: EntityType | string;
  taxId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  registrationReason?: string;
  businessDescription?: string;
  referralSource?: string;
}

export interface AdminApprovalRequest {
  registrationId: string;
  adminUserId: string;
  action: ApprovalAction | string;
  notes?: string;
  rejectionReason?: string;
  verificationMethod?: VerificationMethod | string;
  complianceChecks?: ComplianceCheckResult;
}

export interface PasswordChangeRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordResetRequest {
  token: string;
  newPassword: string;
}

// =============================================================================
// RESPONSE / OUTPUT INTERFACES
// =============================================================================

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: Date;
}

export interface RegistrationResponse {
  success: boolean;
  registrationId?: string;
  error?: string;
}

export interface ApprovalResponse {
  success: boolean;
  userId?: string;
  temporaryPassword?: string;
  error?: string;
}

export interface LoginResponse {
  success: boolean;
  userId?: string;
  user?: UserProfile;
  token?: string;
  expiresIn?: number;
  error?: string;
}

export interface TokenVerificationResponse {
  valid: boolean;
  userId?: string;
  tokenType?: TokenType;
  expiresAt?: Date;
  error?: string;
}

export interface PasswordChangeResponse {
  success: boolean;
  error?: string;
  message?: string;
}

// =============================================================================
// DOMAIN MODEL INTERFACES
// =============================================================================

export interface UserRegistration {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  entityId: string;
  entityName: string;
  entityType: EntityType | string;
  taxId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country: string;
  registrationReason?: string;
  businessDescription?: string;
  referralSource?: string;
  status: RegistrationStatus | string;
  approvalNotes?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  metadata?: Record<string, any>;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface UserAccount {
  id: string;
  registrationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  entityId: string;
  entityName: string;
  passwordHash: string;
  passwordSalt: string;
  lastPasswordChangeAt?: Date;
  status: UserStatus | string;
  isEmailVerified: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  loginAttempts: string[];
  accountLockedUntil?: Date;
  roles: UserRole[] | string[];
  permissions: UserPermission[] | string[];
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorVerifiedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  entityName: string;
  roles: UserRole[] | string[];
  permissions: UserPermission[] | string[];
  lastLoginAt?: Date;
  status: UserStatus | string;
  createdAt: Date;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  registrationId?: string;
  token: string;
  tokenHash: string;
  tokenType: TokenType | string;
  temporaryPassword?: string;
  temporaryPasswordHash?: string;
  status: TokenStatus | string;
  expiresAt: Date;
  usedAt?: Date;
  cancelledAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminApproval {
  id: string;
  registrationId: string;
  adminUserId: string;
  action: ApprovalAction | string;
  notes?: string;
  verificationMethod?: VerificationMethod | string;
  verificationDetails?: Record<string, any>;
  complianceChecks?: ComplianceCheckResult;
  complianceNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  registrationId?: string;
  adminUserId?: string;
  action: AuditAction | string;
  actionDescription: string;
  ipAddress?: string;
  userAgent?: string;
  changedFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface EmailNotification {
  id: string;
  userId?: string;
  registrationId?: string;
  recipientEmail: string;
  emailType: string;
  subject: string;
  body: string;
  status: "PENDING" | "SENT" | "FAILED" | "BOUNCED";
  failureReason?: string;
  sentAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// VALIDATION INTERFACES
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errors?: Record<string, string>;
}

export interface PasswordValidationResult extends ValidationResult {
  strength?: "weak" | "fair" | "good" | "strong";
  requirements?: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

export interface EmailValidationResult extends ValidationResult {
  normalized?: string;
  domain?: string;
}

// =============================================================================
// COMPLIANCE INTERFACES
// =============================================================================

export interface ComplianceCheckResult {
  businessVerified: boolean;
  taxIdVerified: boolean;
  addressVerified: boolean;
  identityVerified: boolean;
  [key: string]: boolean;
}

export interface ComplianceIssue {
  id: string;
  userId?: string;
  registrationId?: string;
  issueType: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  resolution?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// SECURITY INTERFACES
// =============================================================================

export interface LoginAttempt {
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

export interface AccountLockout {
  lockedAt: Date;
  lockedUntil: Date;
  reason: string;
  attemptCount: number;
}

export interface SecurityAlert {
  id: string;
  userId: string;
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  details?: Record<string, any>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  createdAt: Date;
}

// =============================================================================
// CONTEXT INTERFACES
// =============================================================================

export interface RequestContext {
  userId?: string;
  user?: UserProfile;
  roles: UserRole[] | string[];
  permissions: UserPermission[] | string[];
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface ServiceContext {
  requestId: string;
  userId?: string;
  adminUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// =============================================================================
// PAGINATION INTERFACES
// =============================================================================

export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

// =============================================================================
// FILTER INTERFACES
// =============================================================================

export interface RegistrationFilter {
  status?: RegistrationStatus | string;
  entityType?: EntityType | string;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
  sortBy?: "createdAt" | "firstName" | "lastName" | "email" | "status";
  sortOrder?: "asc" | "desc";
}

export interface UserFilter {
  status?: UserStatus | string;
  role?: UserRole | string;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
  sortBy?: "createdAt" | "firstName" | "lastName" | "email" | "lastLoginAt";
  sortOrder?: "asc" | "desc";
}

export interface AuditLogFilter {
  action?: AuditAction | string;
  userId?: string;
  registrationId?: string;
  adminUserId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  sortBy?: "createdAt" | "action";
  sortOrder?: "asc" | "desc";
}

// =============================================================================
// STATISTICS INTERFACES
// =============================================================================

export interface RegistrationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  suspended: number;
  averageApprovalTime: number;
  approvalRate: number;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  newUsersThisMonth: number;
  activeUsersThisMonth: number;
  averageLoginFrequency: number;
}

export interface SecurityStats {
  failedLoginAttempts: number;
  lockedAccounts: number;
  suspendedAccounts: number;
  securityAlerts: number;
  criticalAlerts: number;
}

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialChars: string;
  expirationDays?: number;
  historyCount?: number;
}

export interface AccountPolicy {
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  passwordResetTokenExpiryHours: number;
  requireEmailVerification: boolean;
  requireTwoFactor: boolean;
}

export interface RegistrationPolicy {
  requireApproval: boolean;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;
  requireDocumentVerification: boolean;
  autoApproveAfterHours?: number;
  allowedEntityTypes: EntityType[] | string[];
}

// =============================================================================
// EXPORTS / BATCH / NOTIFICATIONS / HELPERS
// =============================================================================

export interface UserDataExport {
  user: UserAccount;
  registrations: UserRegistration[];
  auditLogs: AuditLogEntry[];
  loginHistory: LoginAttempt[];
  exportedAt: Date;
}

export interface RegistrationDataExport {
  registration: UserRegistration;
  approvals: AdminApproval[];
  auditLogs: AuditLogEntry[];
  exportedAt: Date;
}

export interface BatchRegistrationImport {
  registrations: RegistrationRequest[];
  autoApprove?: boolean;
  sendEmails?: boolean;
}

export interface BatchOperationResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
  timestamp: Date;
}

export interface NotificationPreference {
  userId: string;
  emailOnLogin: boolean;
  emailOnPasswordChange: boolean;
  emailOnAccountSuspension: boolean;
  emailOnComplianceIssue: boolean;
  emailOnSecurityAlert: boolean;
  digestFrequency: "immediate" | "daily" | "weekly" | "never";
  createdAt: Date;
  updatedAt: Date;
}

export type PartialUserAccount = Partial<Omit<UserAccount, "id" | "createdAt">>;
export type PartialUserRegistration = Partial<Omit<UserRegistration, "id" | "createdAt">>;
export type SafeUserAccount = Omit<UserAccount, "passwordHash" | "passwordSalt" | "twoFactorSecret">;
export type SafeUserRegistration = Omit<UserRegistration, "taxId">;

export interface UserRegistrationBuilder {
  withFirstName(firstName: string): UserRegistrationBuilder;
  withLastName(lastName: string): UserRegistrationBuilder;
  withEmail(email: string): UserRegistrationBuilder;
  withEntity(entityId: string, entityName: string, entityType: EntityType): UserRegistrationBuilder;
  withAddress(address: string, city: string, state: string, zipCode: string): UserRegistrationBuilder;
  build(): RegistrationRequest;
}

export interface UserAccountBuilder {
  withFirstName(firstName: string): UserAccountBuilder;
  withLastName(lastName: string): UserAccountBuilder;
  withEmail(email: string): UserAccountBuilder;
  withRoles(roles: UserRole[]): UserAccountBuilder;
  withPermissions(permissions: UserPermission[]): UserAccountBuilder;
  build(): Partial<UserAccount>;
}










