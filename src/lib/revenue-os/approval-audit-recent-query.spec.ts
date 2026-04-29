import {
  countApprovalAuditWhereClauses,
  parseApprovalAuditRecentQueryParams,
} from "@/lib/revenue-os/approval-audit-recent-query";

function parse(url: string) {
  return parseApprovalAuditRecentQueryParams(new URL(url).searchParams);
}

describe("parseApprovalAuditRecentQueryParams", () => {
  it("defaults limit to 5", () => {
    expect(parse("http://x/a").limit).toBe(5);
  });

  it("clamps limit to max 25", () => {
    expect(parse("http://x/a?limit=999").limit).toBe(25);
    expect(parse("http://x/a?limit=25").limit).toBe(25);
  });

  it("clamps limit to min 1", () => {
    expect(parse("http://x/a?limit=0").limit).toBe(1);
    expect(parse("http://x/a?limit=-3").limit).toBe(1);
  });

  it("uses 5 when limit is not a finite number", () => {
    expect(parse("http://x/a?limit=NaN").limit).toBe(5);
  });

  it("parses postId", () => {
    expect(parse("http://x/a?postId=abc-123").postId).toBe("abc-123");
  });

  it("trims postId", () => {
    expect(parse("http://x/a?postId=%20pid%20").postId).toBe("pid");
  });

  it("truncates platform to 24 chars", () => {
    const long = "x".repeat(30);
    expect(parse(`http://x/a?platform=${long}`).platform.length).toBe(24);
  });

  it("counts where clauses for postId / platform filters (must match route branching)", () => {
    expect(countApprovalAuditWhereClauses({ postId: "", platform: "" })).toBe(2);
    expect(countApprovalAuditWhereClauses({ postId: "p1", platform: "" })).toBe(3);
    expect(countApprovalAuditWhereClauses({ postId: "", platform: "linkedin" })).toBe(3);
    expect(countApprovalAuditWhereClauses({ postId: "p1", platform: "linkedin" })).toBe(4);
  });
});
