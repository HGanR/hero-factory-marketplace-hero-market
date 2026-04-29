import type { MinuteRow, ResolutionRow, MinuteBookRow } from "@/lib/db/schema";

type RequiredRole = "Trustee" | "Manager" | "Director" | "Officer" | "Member" | "LeadTrustee" | "ManagingMember" | "Chair" | "Secretary";

export function buildRequiredApprovalsForMinutes(
  minutes: MinuteRow & { minuteBook: MinuteBookRow }
): {
  minutesApprovals: { requiredRole: RequiredRole }[];
  resolutionApprovals: (res: ResolutionRow) => { requiredRole: RequiredRole }[];
} {
  const objectType = minutes.minuteBook.entityType;

  const minutesApprovals: { requiredRole: RequiredRole }[] =
    objectType === "Trust"
      ? [{ requiredRole: "Trustee" }]
      : objectType === "LLC"
      ? [{ requiredRole: "Manager" }]
      : objectType === "C-Corp"
      ? [{ requiredRole: "Director" }]
      : [{ requiredRole: "Manager" }];

  const resolutionApprovals = (res: ResolutionRow): { requiredRole: RequiredRole }[] => {
    if (objectType === "Trust") {
      return [{ requiredRole: "Trustee" }];
    }
    if (res.resolutionType === "Banking") {
      return objectType === "C-Corp" ? [{ requiredRole: "Officer" }] : [{ requiredRole: "Manager" }];
    }
    if (res.resolutionType === "ContractApproval") {
      return objectType === "C-Corp" ? [{ requiredRole: "Director" }] : [{ requiredRole: "Manager" }];
    }
    return [{ requiredRole: "Manager" }];
  };

  return { minutesApprovals, resolutionApprovals };
}
