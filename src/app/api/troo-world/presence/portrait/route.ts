import {NextRequest} from 'next/server';
import {resolvePortrait} from '@/lib/troo-world/presence-portrait';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const bytes=await resolvePortrait(new URL(req.url).searchParams.get('ref'));return new Response(bytes?new Uint8Array(bytes):null,{status:bytes?200:404,headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});}
