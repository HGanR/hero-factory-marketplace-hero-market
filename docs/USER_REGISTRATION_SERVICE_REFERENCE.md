# User Registration Service (Reference from 12334566 folder)

The complete user-registration flow (submission, admin approval, temp password, emails, audit logging) from the `12334566` folder is captured here for reference. This code is **not wired into the current app build** because the required tables and routes are not present in the existing schema. Use this as a blueprint when adding the missing tables/endpoints.

## Reference Service (verbatim logic, trimmed imports)
```typescript
// Reference only — requires userRegistrations, users, passwordResetTokens, adminApprovals, auditLogs tables.
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db';
import {
  userRegistrations,
  users,
  passwordResetTokens,
  adminApprovals,
  auditLogs,
} from '../db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { EmailNotificationService } from './email-notification-service';

export class UserRegistrationService {
  private emailService: EmailNotificationService;
  private passwordSaltRounds = 10;
  private maxLoginAttempts = 5;
  private lockoutDuration = 15 * 60 * 1000; // 15 minutes
  private passwordResetTokenExpiry = 24 * 60 * 60 * 1000; // 24 hours

  constructor(emailProvider: 'sendgrid' | 'nodemailer' | 'aws-ses' = 'nodemailer') {
    this.emailService = new EmailNotificationService(emailProvider);
  }

  // submitRegistration, approveRegistration (creates user + temp password + reset token),
  // rejectRegistration, login with lockout + security alert, password reset, change password,
  // audit logging helpers, validation helpers...
}
```

## What’s needed to make it work here
1) **Schema additions** (Drizzle `src/lib/db/schema.ts`):
   - `userRegistrations` (status, contact fields, metadata, submittedAt/approvedAt, etc.)
   - `passwordResetTokens`
   - `adminApprovals`
   - Extend `users` with fields used here: `registrationId`, `status`, `roles`, `permissions`, `metadata`, `loginAttempts`, `accountLockedUntil`, `lastLoginAt`, `lastLoginIp`, `lastPasswordChangeAt`, `isEmailVerified`, `passwordSalt`, etc.
2) **Migrations**: After adding tables/columns, run `npm run db:push` (or your migration flow) against the production TiDB.
3) **Routes**: Add API endpoints for registration submit, admin approval/reject, password reset, login (or adapt to existing auth routes).
4) **Email integration**: The service already uses `EmailNotificationService` (now present in `src/services/email-notification-service.ts`) and the `email_notifications` table you added earlier. Ensure email provider env vars are set.
5) **UI wiring**: Connect the landing-page registration form to the submit endpoint, and the admin panel to the pending/approval endpoints so the admin can approve and generate temp passwords.

## Why it’s parked in docs
Placing this code directly under `src/` would break the build because the required tables and types do not yet exist in the current schema. Once the tables and routes are added, the service can be moved into `src/services/user-registration-service.ts` and imported where needed.










