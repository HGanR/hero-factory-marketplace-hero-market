/**
 * @jest-environment node
 */
import { POST } from "./route";
import { getDb } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

describe("POST /api/demo/share", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 400 when kind or title is missing", async () => {
    const req = new Request("http://localhost/api/demo/share", {
      method: "POST",
      body: JSON.stringify({ kind: "buyer" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 503 when database is unavailable", async () => {
    mockGetDb.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const req = new Request("http://localhost/api/demo/share", {
      method: "POST",
      body: JSON.stringify({ kind: "buyer", title: "Test demo", payload: { a: 1 }, schema: { b: 2 } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/Share storage unavailable/i);
  });

  it("returns slug and path when insert succeeds", async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    mockGetDb.mockResolvedValue({
      insert: jest.fn(() => ({ values })),
    } as unknown as Awaited<ReturnType<typeof getDb>>);

    const req = new Request("http://localhost/api/demo/share", {
      method: "POST",
      body: JSON.stringify({
        kind: "ret",
        title: "Listing preview",
        payload: { x: 1 },
        schema: { pages: [] },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; slug?: string; path?: string };
    expect(body.ok).toBe(true);
    expect(body.slug).toMatch(/^[a-f0-9]{10}$/);
    expect(body.path).toBe(`/demo/${body.slug}`);
    expect(values).toHaveBeenCalled();
  });
});
