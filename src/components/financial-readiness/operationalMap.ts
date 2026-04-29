import type { FrCase, VaultDocument } from "./vaultTypes";

export type OperationalOp = "mailed" | "awaiting_response" | "responded" | "resolved" | "escalate" | "reopen";

function uniq(tags: string[], add: string): string[] {
  return [...new Set([...tags, add])];
}

export function applyOperationalToDoc(doc: VaultDocument, op: OperationalOp): Partial<VaultDocument> {
  switch (op) {
    case "mailed":
      return { tags: uniq(doc.tags, "mailed") };
    case "awaiting_response":
      return { status: "awaiting_response" };
    case "responded":
      return { status: "in_progress", tags: uniq(doc.tags, "responded") };
    case "resolved":
      return { status: "completed" };
    case "escalate":
      return { status: "escalated" };
    case "reopen":
      return { status: "in_progress" };
  }
}

export function applyOperationalToCase(c: FrCase, op: OperationalOp): Partial<FrCase> {
  switch (op) {
    case "mailed":
      return { tags: uniq(c.tags, "mailed") };
    case "awaiting_response":
      return { status: "awaiting_response" };
    case "responded":
      return { status: "in_progress", tags: uniq(c.tags, "responded") };
    case "resolved":
      return { status: "completed" };
    case "escalate":
      return { status: "escalated" };
    case "reopen":
      return { status: "in_progress" };
  }
}
