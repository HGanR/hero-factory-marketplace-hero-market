import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { engineRouteActor, EngineAccessError } from '@/lib/security/engine-route-access';

export const dynamic = 'force-dynamic';

/** The shared-world editor requires a platform admin, not merely member sign-in. */
export default async function GreenTerrainEditorLayout({ children }: { children: ReactNode }) {
  let actor;
  try {
    actor = await engineRouteActor({ cookies: await cookies() });
  } catch (error) {
    if (error instanceof EngineAccessError && error.status === 401) redirect('/admin');
    // Missing production JWT configuration and infrastructure errors stay fail-closed.
    throw error;
  }
  if (!actor.admin) notFound();
  return children;
}
