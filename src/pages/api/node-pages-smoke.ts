import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Pages Router Node API smoke test. Compare to App Router `/api/admin/db-probe` (Edge) and
 * other App Router `runtime = "nodejs"` routes.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ok: true,
    marker: "pages-node-smoke",
    node: process.version,
    timestamp: new Date().toISOString(),
  });
}
