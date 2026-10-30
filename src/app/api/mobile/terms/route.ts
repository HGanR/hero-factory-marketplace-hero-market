import {NextRequest, NextResponse} from 'next/server';
import jwt from 'jsonwebtoken';
import {getConnection} from '@/lib/db';
import {mobileMemberId, mobileSameOrigin} from '@/lib/mobile/session-policy';
import {activeMemberTerms} from '@/lib/mobile/terms-document';
import {isTermsAcceptance, recordTermsAcceptance, TermsEligibilityError} from '@/lib/mobile/terms-acceptance';

export const dynamic = 'force-dynamic';
function reply(body: object, status = 200) {
 return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store',Vary:'Cookie'}});
}
export async function POST(request: NextRequest) {
 if(process.env.SMART_TRUST_MOBILE_ENABLED!=='true' || process.env.SMART_TRUST_MOBILE_TERMS_REQUIRED!=='true')return reply({error:'Unavailable'},404);
 if(!mobileSameOrigin(request))return reply({error:'Same-origin request required.'},403);
 if(!process.env.JWT_SECRET?.trim())return reply({error:'Account service is not configured.'},503);
 const cookie=process.env.SMART_TRUST_MOBILE_SESSION_COOKIE==='__Host-smart-trust-mobile'?'__Host-smart-trust-mobile':'auth-token';
 const token=request.cookies.get(cookie)?.value;
 let memberId: number|null = null;
 try { if(token)memberId=mobileMemberId(jwt.verify(token,process.env.JWT_SECRET!,{algorithms:['HS256']})); } catch {}
 if(!memberId)return reply({error:'A member session is required.'},401);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required.'},415);
 const text=await request.text();if(text.length>2048)return reply({error:'Request too large.'},413);
 let input: unknown;try{input=JSON.parse(text);}catch{return reply({error:'Invalid acceptance request.'},400);}
 const document=activeMemberTerms();if(!document)return reply({error:'Member terms are not published yet.'},503);
 if(!isTermsAcceptance(input,document))return reply({error:'Confirm acceptance of the current terms. Reload if the terms changed.'},409);
 try {
  const receipt=await recordTermsAcceptance(await getConnection(),memberId,document);
  return reply({accepted:true,receipt});
 }catch(error){return reply({error:error instanceof TermsEligibilityError?'Member approval is required.':'Acceptance could not be saved. Please retry; profile access remains blocked.'},error instanceof TermsEligibilityError?403:503);}
}
