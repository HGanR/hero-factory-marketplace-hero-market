import { mergePriorMessages } from "@/lib/agent-plugins/agent-session-memory";
import type { AgentChatTurn } from "@/lib/agent-plugins/write-confirmation-context";

describe("mergePriorMessages", () => {
  const a: AgentChatTurn[] = [{ role: "user", content: "one" }];
  const longer: AgentChatTurn[] = [
    { role: "user", content: "one" },
    { role: "assistant", content: "two" },
  ];

  it("returns stored when client is empty", () => {
    expect(mergePriorMessages(longer, [])).toEqual(longer);
  });

  it("returns client when stored is empty", () => {
    expect(mergePriorMessages([], longer)).toEqual(longer);
  });

  it("prefers the longer branch so server transcript wins over truncated client", () => {
    expect(mergePriorMessages(longer, a)).toEqual(longer);
  });

  it("prefers client when it has more turns than server", () => {
    expect(mergePriorMessages(a, longer)).toEqual(longer);
  });
});
