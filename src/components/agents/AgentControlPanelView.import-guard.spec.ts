import fs from "node:fs";
import path from "node:path";

describe("AgentControlPanelView client import guard", () => {
  it("does not import server-only plugin/db modules", () => {
    const file = path.join(process.cwd(), "src/components/agents/AgentControlPanelView.tsx");
    const content = fs.readFileSync(file, "utf8");
    expect(content).not.toContain('from "@/lib/agent-plugins');
    expect(content).not.toContain('from "@/lib/db');
    expect(content).not.toContain("mysql2");
    expect(content).not.toContain("drizzle-orm");
  });
});
