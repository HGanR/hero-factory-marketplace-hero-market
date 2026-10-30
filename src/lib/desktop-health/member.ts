import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { getConnection } from '@/lib/db';
import { mysqlTruthy } from '@/lib/mysqlTruthy';
import { mobileMemberId } from '@/lib/mobile/session-policy';
async function lookupMember(id:number):Promise<{id:unknown;isActive:unknown;isApproved:unknown}|null>{
  const db=await getConnection();
  const [rows]=await db.execute<RowDataPacket[]>('SELECT id,isActive,isApproved FROM marketplace_users WHERE id=? LIMIT 1',[id]);
  return rows[0] as {id:unknown;isActive:unknown;isApproved:unknown}|undefined??null;
}
export async function healthMemberId(request:NextRequest,lookup=lookupMember):Promise<number|null>{
  const secret=process.env.JWT_SECRET?.trim(),token=request.cookies.get('auth-token')?.value;
  if(!secret||!token)return null;
  let id:number|null;
  try{id=mobileMemberId(jwt.verify(token,secret,{algorithms:['HS256']}));}catch{return null;}
  if(!id)return null;
  const user=await lookup(id);
  return user&&mysqlTruthy(user.isActive)&&mysqlTruthy(user.isApproved)&&Number(user.id)===id?id:null;
}
