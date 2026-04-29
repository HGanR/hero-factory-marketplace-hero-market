import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getClientPortalServiceDisplayForClientId } from "@/lib/client-portal/client-service-status";
import { getClientPortalSession } from "@/lib/client-portal/portal-session";
import { ClientPortalChrome } from "@/components/client-portal/ClientPortalChrome";

export default async function ClientPortalDashLayout({ children }: { children: ReactNode }) {
  const s = await getClientPortalSession();
  if (!s) {
    redirect("/client-portal/login");
  }
  const service = await getClientPortalServiceDisplayForClientId(s.client.id);
  return (
    <ClientPortalChrome session={s} service={service}>
      {children}
    </ClientPortalChrome>
  );
}
