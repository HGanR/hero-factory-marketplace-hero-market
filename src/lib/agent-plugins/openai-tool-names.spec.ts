import { actionKeyToOpenAiFunctionName, openAiFunctionNameToActionKey } from "@/lib/agent-plugins/openai-tool-names";
import { AGENT_RUNTIME_ACTION_KEYS } from "@/lib/agent-plugins/registry";

describe("actionKey ↔ OpenAI function name mapping", () => {
  it("round-trips every runtime action key", () => {
    for (const key of AGENT_RUNTIME_ACTION_KEYS) {
      const name = actionKeyToOpenAiFunctionName(key);
      expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(openAiFunctionNameToActionKey(name)).toBe(key);
    }
  });
});
