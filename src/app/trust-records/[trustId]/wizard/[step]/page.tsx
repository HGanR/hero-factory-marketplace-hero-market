import { redirect } from "next/navigation";
import { isStepAllowed, getWizardSteps, type WizardStepId } from "@/lib/trust/wizardConfig";
import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Avoid running DB during static "Collecting page data" — this route is always request-time. */
export const dynamic = "force-dynamic";

export default async function WizardStepPage({
  params,
}: {
  params: Promise<{ trustId: string; step: string }>;
}) {
  const { trustId, step: stepParam } = await params;
  const db = await getDb();
  const trustRows = await db.select({
    id: trusts.id,
    trustMode: trusts.trustMode,
  }).from(trusts).where(eq(trusts.id, trustId)).limit(1);

  const trust = trustRows[0];
  if (!trust) redirect("/trust-records");

  const step = stepParam as WizardStepId;
  const mode = (trust.trustMode ?? "standard") as "standard" | "private_safe";

  if (!isStepAllowed(step, mode)) {
    // redirect to first allowed step or overview
    const first = getWizardSteps(mode)[0] ?? "overview";
    redirect(`/trust-records/${trust.id}/wizard/${first}`);
  }

  // Render your actual step component
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Wizard: {step}</h1>
      {/* your step render logic */}
    </div>
  );
}
