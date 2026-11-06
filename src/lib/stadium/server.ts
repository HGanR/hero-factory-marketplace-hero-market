import { and,eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { meetingNodePlacements as nodes, trooWorldPlacements as placements, meetingInvites } from '@/lib/db/schema';
import { verifyToken } from '@/lib/auth';
import { decideStadium,validPass } from './admission';
export function stadiumUser(req:NextRequest) {
  const token=req.cookies.get('admin-token')?.value || req.cookies.get('auth-token')?.value;
  const claims=token ? verifyToken(token) : null;
  return typeof claims?.userId==='number'?claims.userId:claims?.isAdmin?0:null;
}
export const physical=(id:string)=>'stadium-event-'+id.toLowerCase();
export async function stadiumNode(id:string) {
  const db=await getDb();
  const [row]=await db.select({node:nodes}).from(nodes).innerJoin(placements,eq(nodes.parentPlacementId,placements.id))
    .where(and(eq(nodes.id,id),eq(placements.elementKey,'stadium-elyseum'))).limit(1);
  return row?.node;
}
export async function stadiumAccess(req:NextRequest,node:NonNullable<Awaited<ReturnType<typeof stadiumNode>>>) {
  const user=stadiumUser(req), pass=req.cookies.get('stadium-pass-'+node.id)?.value;
  let invited=false;
  if(user!==null && pass && /^[a-f0-9]{64}$/.test(pass)){
    const db=await getDb();
    const [invite]=await db.select().from(meetingInvites).where(and(eq(meetingInvites.meetingNodeId,node.id),eq(meetingInvites.inviteToken,pass))).limit(1);
    invited=invite?.invitedByUserId===node.createdByUserId && validPass(invite,user,Date.now());
  }
  return {...decideStadium(node,user,invited),user};
}
