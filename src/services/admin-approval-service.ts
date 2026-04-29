/**
 * Admin Approval Service
 *
 * Handles admin approval/rejection of user registrations with complete status management,
 * compliance checking, audit logging, and email notifications.
 *
 * NOTE: This file is added standalone and does not change existing admin password generation flows.
 * Hook it up where needed without altering the current admin panel behavior.
 */

import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcryptjs";

import {
  AdminApprovalRequest,
  ApprovalResponse,
  ApprovalAction,
  RegistrationStatus,
  UserStatus,
  AuditAction,
  UserRegistration,
  UserAccount,
  AdminApproval,
  ComplianceCheckResult,
  VerificationMethod,
  TokenType,
  TokenStatus,
} from "@/types/user-registration-types";
import { EmailNotificationService } from "@/services/email-notification-service";
import { Logger } from "@/lib/xrpl/logger";

export class AdminApprovalService {
  private emailService: EmailNotificationService;
  private logger: Logger;
  private readonly TEMP_PASSWORD_LENGTH = 16;
  private readonly BCRYPT_ROUNDS = 10;

  constructor(emailProvider: "sendgrid" | "nodemailer" | "aws-ses" = "sendgrid") {
    this.emailService = new EmailNotificationService(emailProvider);
    this.logger = new Logger("AdminApprovalService");
  }

  /**
   * Approve a user registration
   *
   * Creates a user account, generates temporary password, sends welcome email,
   * and updates registration status to APPROVED.
   */
  async approveRegistration(request: AdminApprovalRequest, db: any): Promise<ApprovalResponse> {
    const requestId = uuidv4();
    this.logger.info(`[${requestId}] Starting approval process`, {
      registrationId: request.registrationId,
      adminUserId: request.adminUserId,
    });

    try {
      this.validateApprovalRequest(request);

      const registration = await this.getRegistration(request.registrationId, db);
      if (!registration) {
        this.logger.error(`[${requestId}] Registration not found`, {
          registrationId: request.registrationId,
        });
        return { success: false, error: "Registration not found" };
      }

      if (registration.status !== RegistrationStatus.PENDING_ADMIN_APPROVAL) {
        this.logger.warn(`[${requestId}] Registration already processed`, {
          registrationId: request.registrationId,
          currentStatus: registration.status,
        });
        return { success: false, error: `Registration already ${registration.status.toLowerCase()}` };
      }

      if (request.complianceChecks) {
        const complianceValid = this.validateComplianceChecks(request.complianceChecks);
        if (!complianceValid) {
          this.logger.warn(`[${requestId}] Compliance checks incomplete`, {
            registrationId: request.registrationId,
            checks: request.complianceChecks,
          });
          return { success: false, error: "Compliance checks must be completed before approval" };
        }
      }

      const temporaryPassword = this.generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, this.BCRYPT_ROUNDS);
      const passwordSalt = await bcrypt.genSalt(this.BCRYPT_ROUNDS);

      const userId = uuidv4();
      const userAccount: Partial<UserAccount> = {
        id: userId,
        registrationId: request.registrationId,
        firstName: registration.firstName,
        lastName: registration.lastName,
        email: registration.email,
        phoneNumber: registration.phoneNumber,
        entityId: registration.entityId,
        entityName: registration.entityName,
        passwordHash,
        passwordSalt,
        status: UserStatus.PENDING_PASSWORD_CHANGE,
        isEmailVerified: false,
        loginAttempts: [],
        roles: ["user"],
        permissions: ["read:own_documents", "write:own_documents"],
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const resetToken = this.generateResetToken();
      const resetTokenHash = await this.hashToken(resetToken);
      const tokenId = uuidv4();

      await db.transaction(async (trx: any) => {
        await trx("users").insert(userAccount);

        await trx("password_reset_tokens").insert({
          id: tokenId,
          userId,
          registrationId: request.registrationId,
          token: resetToken,
          tokenHash: resetTokenHash,
          tokenType: TokenType.INITIAL_PASSWORD,
          temporaryPassword,
          temporaryPasswordHash: passwordHash,
          status: TokenStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await trx("user_registrations")
          .where("id", request.registrationId)
          .update({
            status: RegistrationStatus.APPROVED,
            approvedBy: request.adminUserId,
            approvedAt: new Date(),
            approvalNotes: request.notes,
            metadata: {
              verificationMethod: request.verificationMethod,
              complianceChecks: request.complianceChecks,
            },
            updatedAt: new Date(),
          });

        await trx("admin_approvals").insert({
          id: uuidv4(),
          registrationId: request.registrationId,
          adminUserId: request.adminUserId,
          action: ApprovalAction.APPROVED,
          notes: request.notes,
          verificationMethod: request.verificationMethod,
          verificationDetails: { complianceChecks: request.complianceChecks },
          complianceChecks: request.complianceChecks,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await trx("audit_logs").insert({
          id: uuidv4(),
          userId,
          registrationId: request.registrationId,
          adminUserId: request.adminUserId,
          action: AuditAction.REGISTRATION_APPROVED,
          actionDescription: `Registration approved by ${request.adminUserId}`,
          changedFields: ["status", "approvedBy", "approvedAt"],
          newValues: {
            status: RegistrationStatus.APPROVED,
            approvedBy: request.adminUserId,
            approvedAt: new Date(),
          },
          metadata: {
            verificationMethod: request.verificationMethod,
            complianceChecks: request.complianceChecks,
          },
          createdAt: new Date(),
        });
      });

      const emailResult = await this.emailService.sendWelcomeApprovedEmail(
        registration.email,
        registration.firstName,
        registration.lastName,
        temporaryPassword,
        resetToken,
        userId
      );

      if (!emailResult.success) {
        this.logger.warn(`[${requestId}] Welcome email failed to send`, {
          userId,
          email: registration.email,
          error: emailResult.error,
        });
      }

      this.logger.info(`[${requestId}] Registration approved successfully`, {
        userId,
        registrationId: request.registrationId,
        adminUserId: request.adminUserId,
      });

      return { success: true, userId, temporaryPassword };
    } catch (error: any) {
      this.logger.error(`[${requestId}] Approval failed`, {
        error: error instanceof Error ? error.message : String(error),
        registrationId: request.registrationId,
      });
      return { success: false, error: error instanceof Error ? error.message : "Approval failed" };
    }
  }

  /**
   * Reject a user registration
   */
  async rejectRegistration(request: AdminApprovalRequest, db: any): Promise<ApprovalResponse> {
    const requestId = uuidv4();
    this.logger.info(`[${requestId}] Starting rejection process`, {
      registrationId: request.registrationId,
      adminUserId: request.adminUserId,
    });

    try {
      if (!request.rejectionReason) {
        return { success: false, error: "Rejection reason is required" };
      }

      const registration = await this.getRegistration(request.registrationId, db);
      if (!registration) return { success: false, error: "Registration not found" };

      if (registration.status !== RegistrationStatus.PENDING_ADMIN_APPROVAL) {
        return { success: false, error: `Registration already ${registration.status.toLowerCase()}` };
      }

      await db("user_registrations").where("id", request.registrationId).update({
        status: RegistrationStatus.REJECTED,
        rejectionReason: request.rejectionReason,
        updatedAt: new Date(),
      });

      await db("admin_approvals").insert({
        id: uuidv4(),
        registrationId: request.registrationId,
        adminUserId: request.adminUserId,
        action: ApprovalAction.REJECTED,
        notes: request.notes,
        verificationMethod: request.verificationMethod,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db("audit_logs").insert({
        id: uuidv4(),
        registrationId: request.registrationId,
        adminUserId: request.adminUserId,
        action: AuditAction.REGISTRATION_REJECTED,
        actionDescription: `Registration rejected: ${request.rejectionReason}`,
        changedFields: ["status", "rejectionReason"],
        newValues: {
          status: RegistrationStatus.REJECTED,
          rejectionReason: request.rejectionReason,
        },
        createdAt: new Date(),
      });

      const emailResult = await this.emailService.sendRejectionEmail(
        registration.email,
        registration.firstName,
        registration.lastName,
        request.rejectionReason,
        request.notes
      );

      if (!emailResult.success) {
        this.logger.warn(`[${requestId}] Rejection email failed to send`, {
          email: registration.email,
          error: emailResult.error,
        });
      }

      this.logger.info(`[${requestId}] Registration rejected successfully`, {
        registrationId: request.registrationId,
        adminUserId: request.adminUserId,
      });

      return { success: true };
    } catch (error: any) {
      this.logger.error(`[${requestId}] Rejection failed`, {
        error: error instanceof Error ? error.message : String(error),
        registrationId: request.registrationId,
      });
      return { success: false, error: error instanceof Error ? error.message : "Rejection failed" };
    }
  }

  /**
   * Suspend a user account
   */
  async suspendUser(userId: string, adminUserId: string, reason: string, db: any): Promise<ApprovalResponse> {
    const requestId = uuidv4();
    this.logger.info(`[${requestId}] Suspending user`, { userId, adminUserId, reason });

    try {
      const user = await db("users").where("id", userId).first();
      if (!user) return { success: false, error: "User not found" };

      await db("users").where("id", userId).update({ status: UserStatus.SUSPENDED, updatedAt: new Date() });

      await db("audit_logs").insert({
        id: uuidv4(),
        userId,
        adminUserId,
        action: AuditAction.ACCOUNT_SUSPENDED,
        actionDescription: `Account suspended: ${reason}`,
        changedFields: ["status"],
        newValues: { status: UserStatus.SUSPENDED },
        metadata: { reason },
        createdAt: new Date(),
      });

      await this.emailService.sendAccountSuspendedEmail(user.email, user.firstName, user.lastName, reason, userId);

      this.logger.info(`[${requestId}] User suspended successfully`, { userId, adminUserId });
      return { success: true };
    } catch (error: any) {
      this.logger.error(`[${requestId}] Suspension failed`, {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return { success: false, error: error instanceof Error ? error.message : "Suspension failed" };
    }
  }

  /**
   * Reactivate a suspended user account
   */
  async reactivateUser(userId: string, adminUserId: string, db: any): Promise<ApprovalResponse> {
    const requestId = uuidv4();
    this.logger.info(`[${requestId}] Reactivating user`, { userId, adminUserId });

    try {
      const user = await db("users").where("id", userId).first();
      if (!user) return { success: false, error: "User not found" };

      if (user.status !== UserStatus.SUSPENDED) {
        return { success: false, error: `User is not suspended (current status: ${user.status})` };
      }

      await db("users").where("id", userId).update({ status: UserStatus.ACTIVE, updatedAt: new Date() });

      await db("audit_logs").insert({
        id: uuidv4(),
        userId,
        adminUserId,
        action: AuditAction.ACCOUNT_REACTIVATED,
        actionDescription: "Account reactivated",
        changedFields: ["status"],
        newValues: { status: UserStatus.ACTIVE },
        createdAt: new Date(),
      });

      await this.emailService.sendAccountReactivatedEmail(user.email, user.firstName, user.lastName, userId);

      this.logger.info(`[${requestId}] User reactivated successfully`, { userId, adminUserId });
      return { success: true };
    } catch (error: any) {
      this.logger.error(`[${requestId}] Reactivation failed`, {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return { success: false, error: error instanceof Error ? error.message : "Reactivation failed" };
    }
  }

  /**
   * Get approval history for a registration
   */
  async getApprovalHistory(registrationId: string, db: any): Promise<AdminApproval[]> {
    try {
      return await db("admin_approvals").where("registrationId", registrationId).orderBy("createdAt", "desc");
    } catch (error: any) {
      this.logger.error("Failed to get approval history", {
        error: error instanceof Error ? error.message : String(error),
        registrationId,
      });
      return [];
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(db: any): Promise<{
    total: number;
    approved: number;
    rejected: number;
    suspended: number;
    averageApprovalTime: number;
  }> {
    try {
      const stats = await db("admin_approvals")
        .select(db.raw("COUNT(*) as total"))
        .select(db.raw("COUNT(CASE WHEN action = 'APPROVED' THEN 1 END) as approved"))
        .select(db.raw("COUNT(CASE WHEN action = 'REJECTED' THEN 1 END) as rejected"))
        .select(db.raw("COUNT(CASE WHEN action = 'SUSPENDED' THEN 1 END) as suspended"))
        .first();

      const avgTime = await db("user_registrations")
        .where("status", RegistrationStatus.APPROVED)
        .select(db.raw("AVG(EXTRACT(EPOCH FROM (approvedAt - createdAt))/3600) as avg_hours"))
        .first();

      return {
        total: parseInt(stats.total) || 0,
        approved: parseInt(stats.approved) || 0,
        rejected: parseInt(stats.rejected) || 0,
        suspended: parseInt(stats.suspended) || 0,
        averageApprovalTime: parseFloat(avgTime?.avg_hours) || 0,
      };
    } catch (error: any) {
      this.logger.error("Failed to get approval stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { total: 0, approved: 0, rejected: 0, suspended: 0, averageApprovalTime: 0 };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private validateApprovalRequest(request: AdminApprovalRequest): void {
    if (!request.registrationId) throw new Error("Registration ID is required");
    if (!request.adminUserId) throw new Error("Admin user ID is required");
    if (!request.action) throw new Error("Action is required");
    if (!Object.values(ApprovalAction).includes(request.action as ApprovalAction)) {
      throw new Error("Invalid action");
    }
  }

  private validateComplianceChecks(checks: ComplianceCheckResult): boolean {
    return checks.businessVerified && checks.taxIdVerified && checks.addressVerified && checks.identityVerified;
  }

  private async getRegistration(registrationId: string, db: any): Promise<UserRegistration | null> {
    try {
      return await db("user_registrations").where("id", registrationId).first();
    } catch (error: any) {
      this.logger.error("Failed to get registration", {
        error: error instanceof Error ? error.message : String(error),
        registrationId,
      });
      return null;
    }
  }

  private generateTemporaryPassword(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < this.TEMP_PASSWORD_LENGTH; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private generateResetToken(): string {
    return uuidv4() + uuidv4();
    }

  private async hashToken(token: string): Promise<string> {
    const crypto = await import("crypto");
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}

export function createAdminApprovalService(emailProvider: "sendgrid" | "nodemailer" | "aws-ses" = "sendgrid") {
  return new AdminApprovalService(emailProvider);
}

