import { NewDeedWizard } from "@/components/deeds/NewDeedWizard";

export default async function NewTrustDeedPage({ params }: { params: Promise<{ trustId: string }> }) {
  const { trustId } = await params;
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-semibold">New Deed</div>
        <div className="text-sm text-muted-foreground">
          Create a deed draft, link governance approval, then generate a draft PDF.
        </div>
      </div>

      <NewDeedWizard trustId={trustId} />
    </div>
  );
}
