import { NextRequest, NextResponse } from 'next/server';
import { GET as session } from '@/app/api/mobile/session/route';
import { getConnection } from '@/lib/db';
import { mobileSameOrigin } from '@/lib/mobile/session-policy';
import { profileSkin, saveMemberSkin, profileImage, readMemberProfile, saveMemberImage, readMemberWorlds, type ProfileField } from '@/lib/mobile/profile';
export const dynamic = 'force-dynamic';
function reply(body: object, status = 200) {
  return NextResponse.json(body, {status, headers: {'Cache-Control':'no-store', Vary:'Cookie'}});
}
async function member(request: NextRequest) {
  const response = await session(request);
  if (!response.ok) return {response};
  const data = await response.json();
  if (data.access) return {response: reply({error:'Current member terms must be accepted before profile access.'},403)};
  if (data.user?.role === 'administrator' || !Number.isSafeInteger(data.user?.id) || data.user.id < 1) return {response: reply({error:'A member profile is required. Administrator access is separate.'},403)};
  return {id: data.user.id as number};
}
export async function GET(request: NextRequest) {
  const access = await member(request); if (access.response) return access.response;
  try {
    const db = await getConnection();
    const profile = await readMemberProfile(db, access.id!);
    let worlds = null;
    try { worlds = await readMemberWorlds(db, access.id!); } catch { /* Distinguish unavailable from an empty account. */ }
    return reply({profile, worlds});
  } catch { return reply({error:'Profile images are unavailable. Please retry. Your existing assets are preserved.'},503); }
}
export async function PATCH(request: NextRequest) {
  if (process.env.SMART_TRUST_MOBILE_ENABLED !== 'true') return reply({error:'Mobile is not enabled.'},404);
  if (!mobileSameOrigin(request)) return reply({error:'Same-origin request required.'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'JSON required.'},415);
  const access = await member(request); if (access.response) return access.response;
  const length = Number(request.headers.get('content-length'));
  if (length > 710000) return reply({error:'Image is too large.'},413);
  let raw = ''; const reader = request.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    for (;;) { const {value,done} = await reader.read(); if (done) break; raw += decoder.decode(value,{stream:true}); if (raw.length > 710000) { await reader.cancel(); return reply({error:'Image is too large.'},413); } }
    raw += decoder.decode();
  }
  let field: ProfileField | 'skin'; let image: string | null;
  try {
    const body = JSON.parse(raw);
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || !['bannerData','avatarData','skin'].includes(Object.keys(body)[0])) throw new Error('Choose one profile image to update.');
    field = Object.keys(body)[0] as ProfileField | 'skin'; image = field === 'skin' ? profileSkin(body.skin) : profileImage(body[field], field);
  } catch { return reply({error:'Choose one supported PNG profile image or Gold, Dawn or Neon skin. Account IDs and other fields cannot be submitted.'},400); }
  try {
    const db = await getConnection(); if (field === 'skin') await saveMemberSkin(db, access.id!, image); else await saveMemberImage(db, access.id!, field, image);
    return reply({saved:true, profile: await readMemberProfile(db, access.id!)});
  } catch { return reply({error:'Image save could not be confirmed. Please retry.'},503); }
}

