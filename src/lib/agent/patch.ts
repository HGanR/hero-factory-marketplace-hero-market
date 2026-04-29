export type JsonPatchOp = {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
};

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_PATCH_BYTES = 50_000;
const MAX_STRING_LENGTH = 10_000;
const MAX_ARRAY_LENGTH = 200;
const MAX_OBJECT_KEYS = 200;

function decodePointerSegment(seg: string): string {
  return seg.replace(/~1/g, "/").replace(/~0/g, "~");
}

function getPathSegments(path: string): string[] {
  if (!path.startsWith("/")) throw new Error(`Invalid JSON pointer: ${path}`);
  return path
    .split("/")
    .slice(1)
    .map(decodePointerSegment)
    .filter((s) => s.length > 0 || s === "");
}

function assertSafeKey(key: string) {
  if (FORBIDDEN_KEYS.has(key)) {
    throw new Error(`Forbidden JSON pointer key: ${key}`);
  }
}

function assertValueSize(value: unknown, path: string) {
  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    throw new Error(`String too large at ${path} (max ${MAX_STRING_LENGTH})`);
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      throw new Error(`Array too large at ${path} (max ${MAX_ARRAY_LENGTH})`);
    }
    value.forEach((v, idx) => assertValueSize(v, `${path}/${idx}`));
    return;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length > MAX_OBJECT_KEYS) {
      throw new Error(`Object too large at ${path} (max ${MAX_OBJECT_KEYS} keys)`);
    }
    keys.forEach((k) => assertValueSize((value as any)[k], `${path}/${k}`));
  }
}

export function validatePatch(patch: JsonPatchOp[], allowedPrefixes: string[]) {
  const raw = JSON.stringify(patch);
  if (raw.length > MAX_PATCH_BYTES) {
    throw new Error(`Patch too large (max ${MAX_PATCH_BYTES} bytes)`);
  }
  for (const op of patch) {
    if (!["add", "replace", "remove"].includes(op.op)) {
      throw new Error(`Unsupported patch op: ${op.op}`);
    }
    if (!allowedPrefixes.some((prefix) => op.path.startsWith(prefix))) {
      throw new Error(`Disallowed patch path: ${op.path}`);
    }
    if (op.op !== "remove") {
      assertValueSize(op.value, op.path);
    }
  }
}

function getContainer(target: any, segments: string[], createMissing: boolean): { parent: any; key: string } {
  let current = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    assertSafeKey(seg);
    const nextIsArrayIndex = segments[i + 1] && /^[0-9]+$/.test(segments[i + 1]);
    if (current[seg] == null) {
      if (!createMissing) throw new Error(`Path not found: /${segments.slice(0, i + 1).join("/")}`);
      current[seg] = nextIsArrayIndex ? [] : {};
    }
    current = current[seg];
  }
  const key = segments[segments.length - 1];
  assertSafeKey(key);
  return { parent: current, key };
}

export function applyJsonPatch<T extends object>(target: T, patch: JsonPatchOp[]): T {
  for (const op of patch) {
    const segments = getPathSegments(op.path);
    const { parent, key } = getContainer(target as any, segments, op.op !== "remove");
    if (Array.isArray(parent)) {
      if (key === "-") {
        if (op.op === "remove") throw new Error("Cannot remove with '-' index");
        parent.push(op.value);
        continue;
      }
      const index = Number(key);
      if (Number.isNaN(index)) throw new Error(`Invalid array index: ${key}`);
      if (op.op === "remove") {
        parent.splice(index, 1);
      } else {
        parent[index] = op.value;
      }
    } else {
      if (op.op === "remove") {
        delete parent[key];
      } else {
        parent[key] = op.value;
      }
    }
  }
  return target;
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}
