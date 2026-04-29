/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getDb } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

describe("GET /api/demo/share/[slug]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 404 when row is missing", async () => {
    const limit = jest.fn().mockResolvedValue([]);
    mockGetDb.mockResolvedValue({
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit,
          })),
        })),
      })),
    } as unknown as Awaited<ReturnType<typeof getDb>>);

    const res = await GET(new Request("http://localhost/api/demo/share/abc"), {
      params: Promise.resolve({ slug: "abc" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns parsed payload and schema when row exists", async () => {
    const limit = jest.fn().mockResolvedValue([
      {
        kind: "buyer",
        title: "T",
        payloadJson: JSON.stringify({ k: 1 }),
        schemaJson: JSON.stringify({ pages: [{ slug: "/", blocks: [] }] }),
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
      },
    ]);
    mockGetDb.mockResolvedValue({
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit,
          })),
        })),
      })),
    } as unknown as Awaited<ReturnType<typeof getDb>>);

    const res = await GET(new Request("http://localhost/api/demo/share/abc123"), {
      params: Promise.resolve({ slug: "abc123" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; kind?: string; payload?: unknown; schema?: unknown };
    expect(body.ok).toBe(true);
    expect(body.kind).toBe("buyer");
    expect((body.payload as { k: number }).k).toBe(1);
    expect((body.schema as { pages: unknown[] }).pages.length).toBe(1);
  });

  it("returns 503 when getDb throws", async () => {
    mockGetDb.mockRejectedValueOnce(new Error("db down"));
    const res = await GET(new Request("http://localhost/api/demo/share/x"), {
      params: Promise.resolve({ slug: "x" }),
    });
    expect(res.status).toBe(503);
  });
});
