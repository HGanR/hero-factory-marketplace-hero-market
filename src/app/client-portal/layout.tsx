import type { ReactNode } from "react";

export default function ClientPortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      {children}
    </div>
  );
}
