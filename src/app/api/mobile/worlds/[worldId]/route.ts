import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { GET as session } from '@/app/api/mobile/session/route';
import { getConnection } from '@/lib/db';
import { mysql2ConnectionOptionsFromUrl } from '@/lib/db/mysql2-connection-options';
import { mobileSameOrigin } from '@/lib/mobile/session-policy';
import { readWorld, writeWorld, WorldError } from '@/lib/mobile/worlds';
export const dynamic = 'force-dynamic';
const reply = (body: object, status=200) => NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
async function member(request: NextRequest) {
  const response = await session(request);
  if (!response.ok) return {response};
  const data = await response.json();
  if (data.access || data.user?.role === 'administrator' || !Number.isSafeInteger(data.user?.id)) return {response:reply({error:'An approved member session is required.'},403)};
  return {id:data.user.id as number};
}
function failure(error: unknown) { return error instanceof WorldError ? reply({error:error.message},error.status) : reply({error:'World storage is unavailable. Existing saved placements are preserved; retry when connected.'},503); }
export async function GET(request: NextRequest, context: {params:Promise<{worldId:string}>}) {
  const access = await member(request); if (access.response) return access.response;
  try { return reply(await readWorld(await getConnection(),access.id!, (await context.params).worldId)); } catch(error) { return failure(error); }
}
export async function POST(request: NextRequest, context: {params:Promise<{worldId:string}>}) {
  if (!mobileSameOrigin(request)) return reply({error:'Same-origin request required.'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'JSON required.'},415);
  const access = await member(request); if (access.response) return access.response;
  // Limit actual streamed bytes, including requests without Content-Length.
  const reader = request.body?.getReader(); let raw = ''; let bytes = 0;
  if (reader) { const decoder=new TextDecoder(); for (;;) {const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1_000_000){await reader.cancel();return reply({error:'World update is too large.'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode(); }
  let body; try {body=JSON.parse(raw);if(!body || Array.isArray(body))throw Error();} catch {return reply({error:'Invalid world update.'},400);}
  let connection: mysql.Connection | undefined;
  try {
    if (!process.env.DATABASE_URL) throw Error('Storage unavailable');
    const options=mysql2ConnectionOptionsFromUrl(process.env.DATABASE_URL);
    connection=typeof options === 'string' ? await mysql.createConnection(options) : await mysql.createConnection(options);
    await connection.beginTransaction();
    const result=await writeWorld(connection,access.id!, (await context.params).worldId,body);
    await connection.commit();
    return reply({saved:true,...result});
  } catch(error) { if(connection)await connection.rollback().catch(()=>{}); return failure(error); }
  finally {if(connection)await connection.end().catch(()=>{});}
}
