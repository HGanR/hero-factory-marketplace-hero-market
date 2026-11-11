import { CheckoutError } from '@/lib/world-checkout/policy';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/api/auth';
import { fulfillAsset } from '@/lib/world-checkout/server';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:Promise<{assetId:string}>}) {
  const userId=await getAuthedUserId();
  if(!userId)return NextResponse.json({error:'Sign in with your member account.'},{status:401});
  if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Same-origin request required.'},{status:403});
  try {
    const text=await request.text();if(text.length>12000)throw new CheckoutError('Request too large.');
    const body=text?JSON.parse(text):{};
    return NextResponse.json(await fulfillAsset(userId,(await params).assetId,body),{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return NextResponse.json({error:error instanceof CheckoutError?error.message:'Purchase could not be confirmed. Do not pay again; retry verification.'},{status:400,headers:{'Cache-Control':'no-store'}});}
}
