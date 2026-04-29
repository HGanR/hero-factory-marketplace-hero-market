import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function ClientPortalLoginPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-center text-2xl font-semibold text-slate-900">Client portal</h1>
      <p className="mt-1 text-center text-sm text-slate-600">Sign in to view your analytics and activity.</p>
      <Suspense fallback={<div className="mt-8 h-40 rounded-lg border border-slate-200 bg-white" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
