import { describe, it, expect } from "@jest/globals";
import { buildJarvaNextActions, buildPathSpecificJarvaQuestionItems } from "./jarva-next-actions";
import type { JarvaTrustIntake } from "./trust-intake-schema";

function intake(p: Partial<JarvaTrustIntake>): JarvaTrustIntake {
  return {
    schemaVersion: 1,
    ...p,
  } as JarvaTrustIntake;
}

describe("buildJarvaNextActions", () => {
  it("sorts hard_blocker before apply_required before packet_quality by priority", () => {
    const a = buildJarvaNextActions(intake({}));
    const cats = a.nextQuestionItems.map((i) => i.category);
    const firstHard = cats.indexOf("hard_blocker");
    const firstApply = cats.indexOf("apply_required");
    const firstPacket = cats.indexOf("packet_quality");
    expect(firstHard).toBe(0);
    expect(firstApply).toBeGreaterThan(firstHard);
    expect(firstPacket).toBeGreaterThan(firstApply);
  });

  it("nextQuestions order matches first 8 questions from nextQuestionItems", () => {
    const a = buildJarvaNextActions(intake({}));
    const fromItems = a.nextQuestionItems.slice(0, 8).map((i) => i.question);
    expect(a.nextQuestions).toEqual(fromItems);
  });

  it("missing grantor / trustee / governing state are hard_blocker", () => {
    const a = buildJarvaNextActions(intake({}));
    const grantorQ = a.nextQuestionItems.find((i) => i.question.includes("grantor"));
    const trusteeQ = a.nextQuestionItems.find((i) => i.question.includes("trustee") && i.question.includes("initial"));
    const stateQ = a.nextQuestionItems.find((i) => i.question.includes("situs state"));
    expect(grantorQ?.category).toBe("hard_blocker");
    expect(trusteeQ?.category).toBe("hard_blocker");
    expect(stateQ?.category).toBe("hard_blocker");
  });

  it("when structural fields are present, remaining gaps use apply_required and packet_quality", () => {
    const base = intake({
      grantor: { name: "G" },
      trustee: { name: "T" },
      governingState: "NY",
    });
    const a = buildJarvaNextActions(base);
    expect(a.nextQuestionItems.some((i) => i.category === "hard_blocker")).toBe(false);
    expect(a.nextQuestionItems.some((i) => i.category === "apply_required")).toBe(true);
    expect(a.nextQuestionItems.some((i) => i.category === "packet_quality")).toBe(true);
  });

  it("priorities increase by tier (hard 1–3, apply 10+, packet 20+)", () => {
    const a = buildJarvaNextActions(intake({}));
    const hard = a.nextQuestionItems.filter((i) => i.category === "hard_blocker");
    const apply = a.nextQuestionItems.filter((i) => i.category === "apply_required");
    const packet = a.nextQuestionItems.filter((i) => i.category === "packet_quality");
    expect(hard.every((i) => i.priority < 10)).toBe(true);
    expect(apply.every((i) => i.priority >= 10 && i.priority < 20)).toBe(true);
    expect(packet.every((i) => i.priority >= 20)).toBe(true);
  });
});

describe("path-aware next questions", () => {
  it("revocable path adds revocable-style guidance", () => {
    const a = buildJarvaNextActions(intake({}), { workflowPath: "trust_revocable" });
    expect(a.nextQuestionItems.some((i) => /Revocable trust path/i.test(i.question))).toBe(true);
    expect(a.suggestions[0]).toMatch(/Revocable/i);
  });

  it("irrevocable path adds funding and beneficiary emphasis", () => {
    const items = buildPathSpecificJarvaQuestionItems("trust_irrevocable", intake({}));
    expect(items.some((i) => /Irrevocable/i.test(i.question))).toBe(true);
    expect(items.some((i) => /beneficiaries/i.test(i.question))).toBe(true);
  });

  it("ecclesiastical path references ecclesiastical wizard", () => {
    const a = buildJarvaNextActions(intake({}), { workflowPath: "trust_ecclesiastical" });
    expect(a.nextQuestionItems.some((i) => /ecclesiastical/i.test(i.question))).toBe(true);
  });

  it("ppm path is securities / private-placement oriented", () => {
    const a = buildJarvaNextActions(intake({}), { workflowPath: "trust_ppm" });
    expect(a.nextQuestionItems.some((i) => /PPM/i.test(i.question))).toBe(true);
    expect(a.suggestions[0]).toMatch(/PPM|securities/i);
  });

  it("bond path is bond / indenture oriented", () => {
    const a = buildJarvaNextActions(intake({}), { workflowPath: "trust_bond" });
    expect(a.nextQuestionItems.some((i) => /Bond|indenture/i.test(i.question))).toBe(true);
  });

  it("certificate path points to Trust Records certificate workflow", () => {
    const a = buildJarvaNextActions(intake({}), { workflowPath: "trust_certificate" });
    expect(a.nextQuestionItems.some((i) => /Trust Records.*Issue|Certificates/i.test(i.question))).toBe(true);
  });

  it("estate path references estate / will", () => {
    const a = buildJarvaNextActions(intake({}), { workflowPath: "trust_estate" });
    expect(a.nextQuestionItems.some((i) => /Estate|will/i.test(i.question))).toBe(true);
  });
});
