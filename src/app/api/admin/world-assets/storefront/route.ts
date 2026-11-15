import {NextRequest,NextResponse} from 'next/server';
import {engineRouteActor,requireSameOrigin,EngineAccessError} from '@/lib/security/engine-route-access';
import {getDb} from '@/lib/db';
import {worldLibraryAssets} from '@/lib/db/schema.worlds';
import {eq} from 'drizzle-orm';
import {STOREFRONT,STOREFRONTS} from '@/lib/world-assets/storefront';
export async function POST(request:NextRequest){
 try{
  const actor=await engineRouteActor(request);if(!actor.admin)throw new EngineAccessError('Administrator access required',403);
  requireSameOrigin(request);
  let key=STOREFRONT.key as string;if(request.headers.get('content-type')?.includes('application/json')){let body;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid listing request.'},{status:400})}key=body.assetKey;}
  const asset=STOREFRONTS.find(a=>a.key===key);if(!asset)return NextResponse.json({error:'Unknown asset.'},{status:400});
  const db=await getDb();
  const [existing]=await db.select().from(worldLibraryAssets).where(eq(worldLibraryAssets.slug,asset.slug)).limit(1);
  const status=process.env.VERCEL_ENV==='production'?'published':'draft';
  if(existing){
   if(existing.id!==asset.id)return NextResponse.json({error:'This slug is already used by another asset.'},{status:409});
   await db.update(worldLibraryAssets).set({name:asset.name,...(status==='published'&&existing.status==='draft'?{status:'published' as const}:{})}).where(eq(worldLibraryAssets.id,existing.id));
   return NextResponse.json({success:true,alreadyExists:true,id:existing.id,tokenPrice:existing.tokenPrice,status});
  }
  await db.insert(worldLibraryAssets).values({id:asset.id,slug:asset.slug,name:asset.name,category:'building',
   description:'Three-floor open-plan storefront with furnishing and wall-art attachment points. Includes use in your owned worlds.',
   modelUrl:asset.modelUrl,previewImageUrl:asset.previewImageUrl,manifestUrl:asset.manifestUrl,
   tokenPrice:asset.tokenPrice,status,isPlatformOnly:false,isActive:true});
  return NextResponse.json({success:true,id:asset.id,tokenPrice:asset.tokenPrice,status},{status:201});
 }catch(error){return NextResponse.json({error:error instanceof EngineAccessError?error.message:'Listing was not created. Retry after checking catalog storage.'},{status:error instanceof EngineAccessError?error.status:503});}
}
