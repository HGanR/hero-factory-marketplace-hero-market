import { actionKeyToOpenAiFunctionName, openAiFunctionNameToActionKey } from "@/lib/agent-plugins/openai-tool-names";
import {
  ACTION_HANDLERS,
  AGENT_RUNTIME_ACTION_KEYS,
  AGENT_PLUGIN_REGISTRY,
  collectDeclaredRuntimeActionKeysFromRegistry,
  getActionDefinition,
} from "@/lib/agent-plugins/registry";
import { ACTION_INPUT_SCHEMAS } from "@/lib/agent-plugins/tool-metadata";

describe("agent plugin registry integrity (Google runtime)", () => {
  it("declared registry actions match handler keys exactly", () => {
    const fromRegistry = collectDeclaredRuntimeActionKeysFromRegistry();
    const fromHandlers = Object.keys(ACTION_HANDLERS).sort();
    expect(fromRegistry).toEqual(fromHandlers);
    expect(fromRegistry).toEqual([...AGENT_RUNTIME_ACTION_KEYS].sort());
  });

  it("every handler key has plugin metadata and kind", () => {
    for (const key of AGENT_RUNTIME_ACTION_KEYS) {
      const def = getActionDefinition(key);
      expect(def).toBeDefined();
      expect(def!.action.runtimeImplemented).toBe(true);
      expect(def!.action.kind === "read" || def!.action.kind === "write").toBe(true);
    }
  });

  it("every runtime action has an input schema and OpenAI-safe function name", () => {
    for (const key of AGENT_RUNTIME_ACTION_KEYS) {
      expect(ACTION_INPUT_SCHEMAS[key]).toBeDefined();
      const name = actionKeyToOpenAiFunctionName(key);
      expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(openAiFunctionNameToActionKey(name)).toBe(key);
    }
  });

  it("write actions require confirmed in JSON schema", () => {
    const writes = AGENT_PLUGIN_REGISTRY.flatMap((p) =>
      p.actions.filter((a) => a.runtimeImplemented && a.kind === "write").map((a) => a.actionKey)
    );
    expect(writes.length).toBeGreaterThan(0);
    for (const key of writes) {
      const schema = ACTION_INPUT_SCHEMAS[key as keyof typeof ACTION_INPUT_SCHEMAS];
      expect(schema).toBeDefined();
      const req = (schema as { required?: string[] }).required;
      expect(req).toContain("confirmed");
      expect((schema as { properties?: Record<string, unknown> }).properties?.confirmed).toBeDefined();
    }
  });

  it("read actions do not require confirmed", () => {
    const reads = AGENT_PLUGIN_REGISTRY.flatMap((p) =>
      p.actions.filter((a) => a.runtimeImplemented && a.kind === "read").map((a) => a.actionKey)
    );
    for (const key of reads) {
      const schema = ACTION_INPUT_SCHEMAS[key as keyof typeof ACTION_INPUT_SCHEMAS];
      const req = (schema as { required?: string[] }).required;
      expect(req ?? []).not.toContain("confirmed");
    }
  });
});
