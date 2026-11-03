import { eq } from "drizzle-orm";
import { web3Sites } from "@/lib/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { ENGINE_CATALOG, ENGINE_RUNTIME_VERSION } from "@/lib/executive-agent/engine-runtime-contract";
import { EngineRuntimeError, operateEngine } from "@/lib/executive-agent/engine-runtime-service";
import { POST as approve } from "@/app/api/admin/executive-agent/approvals/[id]/approve/route";
import { POST as reject } from "@/app/api/admin/executive-agent/approvals/[id]/reject/route";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = {"Cache-Control":"private, no-store", "Vary":"Cookie"};
export async function GET(req: NextRequest) {
  const accountId = await getExecutiveAdminUserId(req);
  if (accountId == null) return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers});
  let businessContext:Record<string,unknown>={sitesUnavailable:true};
  try{
    const db=await getDb();
    const sites=await db.select({id:web3Sites.id,name:web3Sites.name,clientId:web3Sites.clientId,status:web3Sites.status}).from(web3Sites).where(eq(web3Sites.userId,accountId)).limit(50);
    businessContext={sites,siteLimit:50};
  }catch{/* Discovery still works when optional site context is unavailable. */}
  return NextResponse.json({businessContext,ok:true,schema:ENGINE_RUNTIME_VERSION,accountId:String(accountId),observedAt:new Date().toISOString(),engines:ENGINE_CATALOG,
    limits:["Registered adapters are not proof of provider readiness or completed work.","GitNexus is optional code knowledge, not execution authority.","REN/TAYO modeling and native Coding Agent run through their separately governed local adapters.","Stephon intake records a brief; it does not generate a website."]},{headers});
}
export async function POST(req: NextRequest) {
  const accountId = await getExecutiveAdminUserId(req);
  if (accountId == null) return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers});
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ok:false,error:"Same-origin engine request required."},{status:403,headers});
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 32000) return NextResponse.json({ok:false,error:"Request too large."},{status:413,headers});
  try { return NextResponse.json({ok:true,receipt:await operateEngine(await getDb() as unknown as Parameters<typeof operateEngine>[0],accountId,JSON.parse(raw), async (id, operation, humanConfirmed) => {
    // Invoke the existing POST handler in-process; no self-HTTP or alternate dispatcher.
    const url = new URL(req.url);
    url.pathname = `/api/admin/executive-agent/approvals/${encodeURIComponent(id)}/${operation}`;
    url.search = "";
    const decision = new NextRequest(url, {method:"POST", headers:req.headers,
      body:JSON.stringify({humanConfirmed})});
    const result = await (operation === "approve" ? approve : reject)(decision, {params:Promise.resolve({id})});
    const data = await result.json().catch(() => null);
    if (!result.ok || data?.ok !== true) {
      throw new EngineRuntimeError("The gated decision did not confirm success. Read the saved receipt before retrying.", result.ok ? 409 : result.status);
    }
  })},{headers}); }
  catch (error) {
    const status = error instanceof EngineRuntimeError ? error.status : error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError") ? 400 : 500;
    return NextResponse.json({ok:false,error:status === 500 ? "Engine operation did not confirm completion. Check the saved receipt before retrying." : error instanceof EngineRuntimeError ? error.message : "Invalid engine request."},{status,headers});
  }
}

