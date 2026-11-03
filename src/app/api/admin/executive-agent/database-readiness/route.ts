import type { NextRequest } from 'next/server';
import { getExecutiveAdminUserId } from '@/lib/admin/get-executive-admin-user-id';
import { getConnection } from '@/lib/db';
import { databaseReadinessResponse } from '@/lib/executive-agent/database-readiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Authenticated metadata reads only; never enables or invokes the revenue loop. */
export async function GET(req: NextRequest) {
  return databaseReadinessResponse({
    authorize: () => getExecutiveAdminUserId(req),
    getConnection,
  });
}
