import { CheckoutError } from '@/lib/world-checkout/policy';
import { NextRequest,NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/api/auth';
import { prepareOrder } from '@/lib/world-checkout/server';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest) {
  const userId=await getAuthedUserId();
  if(!userId)return NextResponse.json({error:'Sign in with your member account before checkout.'},{status:401});
  if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Same-origin request required.'},{status:403});
  try {
    const text=await request.text();if(text.length>4096)throw new CheckoutError('Request too large.');
    const body=JSON.parse(text);if(typeof body.assetId!=='string'||body.assetId.length>36)throw new CheckoutError('Choose an asset.');
    return NextResponse.json(await prepareOrder(userId,body.assetId,body.wallet),{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return NextResponse.json({error:error instanceof CheckoutError?error.message:'Checkout unavailable.'},{status:400,headers:{'Cache-Control':'no-store'}});}
}
