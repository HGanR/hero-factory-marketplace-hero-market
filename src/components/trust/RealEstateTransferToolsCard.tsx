"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTransferToolAvailability, US_STATE_OPTIONS } from "@/lib/deeds/transfer-tools";

export function RealEstateTransferToolsCard(props: { trustId: string }) {
  const { trustId } = props;
  const [stateCode, setStateCode] = useState("");
  const [stateSelectOpen, setStateSelectOpen] = useState(false);
  const [hasMortgage, setHasMortgage] = useState(false);
  const [hasTitlePolicy, setHasTitlePolicy] = useState(false);
  const [hasHomestead, setHasHomestead] = useState(false);
  const [medicaidPlanning, setMedicaidPlanning] = useState(false);

  const availability = useMemo(() => getTransferToolAvailability(stateCode), [stateCode]);

  const todAvailable = availability.todAvailable;
  const ladyBirdAvailable = availability.ladyBirdAvailable;
  const citations = availability.rules;

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold">Real Estate Transfer Tools</div>
          <div className="text-sm text-muted-foreground">
            State-gated deed workflows for trust funding, TOD, and enhanced life estate deeds.
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className={`grid gap-2 ${stateSelectOpen ? "pb-44 sm:pb-0" : ""}`}>
            <Label>Property state</Label>
            <Select value={stateCode} onValueChange={setStateCode} onOpenChange={setStateSelectOpen}>
              <SelectTrigger className="relative z-20">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent className="z-50 max-h-72">
                {US_STATE_OPTIONS.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 rounded-xl border p-3 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">Title / lender checks</div>
            <label className="flex items-center gap-2">
              <Checkbox checked={hasMortgage} onCheckedChange={(v) => setHasMortgage(Boolean(v))} />
              Mortgage or deed of trust exists
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={hasTitlePolicy} onCheckedChange={(v) => setHasTitlePolicy(Boolean(v))} />
              Title policy or escrow instructions required
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={hasHomestead} onCheckedChange={(v) => setHasHomestead(Boolean(v))} />
              Homestead or property tax exemption in place
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={medicaidPlanning} onCheckedChange={(v) => setMedicaidPlanning(Boolean(v))} />
              Medicaid planning intent
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2">
            <div className="text-xs text-muted-foreground">Available tools</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Trust Transfer</Badge>
              {todAvailable ? <Badge>TOD Deed</Badge> : <Badge variant="outline">TOD (check state)</Badge>}
              {ladyBirdAvailable ? <Badge>Lady Bird</Badge> : <Badge variant="outline">Lady Bird (state gated)</Badge>}
            </div>
          </div>

          <div className="grid gap-2">
            <Button asChild variant="outline">
              <Link href={`/trust-records/${trustId}/assets/deeds/new?tool=trust_transfer`}>
                Transfer to Trust (Quitclaim/Warranty)
              </Link>
            </Button>

            {todAvailable ? (
              <Button asChild variant="outline">
                <Link href={`/trust-records/${trustId}/assets/deeds/new?tool=tod_deed`}>
                  TOD Deed (where available)
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                TOD Deed (check state)
              </Button>
            )}

            {ladyBirdAvailable ? (
              <Button asChild variant="outline">
                <Link href={`/trust-records/${trustId}/assets/deeds/new?tool=lady_bird`}>
                  Enhanced Life Estate (Lady Bird) Deed
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Enhanced Life Estate (Lady Bird) Deed
              </Button>
            )}

            <Button asChild variant="ghost">
              <Link href={`/trust-records/${trustId}/assets/deeds`}>
                Deed Prep Checklist + Title/Escrow Instructions
              </Link>
            </Button>
          </div>

          {(hasMortgage || hasTitlePolicy || hasHomestead || medicaidPlanning) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Review lender, title, tax, and benefits implications before recording.
            </div>
          )}

          {stateCode && (
            <div className="rounded-xl border p-3 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">State references</div>
              <div className="mt-2 space-y-2">
                <div>
                  <div className="font-medium">Recorder directory</div>
                  {citations.recorderDirectoryUrl ? (
                    <a className="underline" href={citations.recorderDirectoryUrl} target="_blank" rel="noreferrer">
                      {citations.recorderDirectoryUrl}
                    </a>
                  ) : (
                    <div>No recorder directory on file.</div>
                  )}
                  {citations.recorderLinkPending ? (
                    <div className="text-[11px] text-muted-foreground">Recorder link pending for this state.</div>
                  ) : null}
                </div>
                <div>
                  <div className="font-medium">TOD Deed</div>
                  {citations.todDeed.citations.length > 0 ? (
                    <ul className="list-disc pl-4">
                      {citations.todDeed.citations.map((c) => (
                        <li key={c.url}>
                          <a className="underline" href={c.url} target="_blank" rel="noreferrer">
                            {c.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : citations.todDeed.citationsPending ? (
                    <div>Citation pending for this state. Verify local law.</div>
                  ) : (
                    <div>No citations on file. Verify local law.</div>
                  )}
                </div>
                <div>
                  <div className="font-medium">Lady Bird Deed</div>
                  {citations.ladyBirdDeed.citations.length > 0 ? (
                    <ul className="list-disc pl-4">
                      {citations.ladyBirdDeed.citations.map((c) => (
                        <li key={c.url}>
                          <a className="underline" href={c.url} target="_blank" rel="noreferrer">
                            {c.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : citations.ladyBirdDeed.citationsPending ? (
                    <div>Citation pending for this state. Verify local law.</div>
                  ) : (
                    <div>No citations on file. Verify local law.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground">
            Not legal advice. State law, lender policy, and title requirements vary. Confirm with counsel or title.
          </div>
        </div>
      </div>
    </div>
  );
}
