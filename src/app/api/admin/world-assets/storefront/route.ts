import {NextRequest,NextResponse} from 'next/server';
import {engineRouteActor,requireSameOrigin,EngineAccessError} from '@/lib/security/engine-route-access';
import {getDb} from '@/lib/db';
import {worldLibraryAssets} from '@/lib/db/schema.worlds';
import {eq} from 'drizzle-orm';
import {STOREFRONT} from '@/lib/world-assets/storefront';
export async function POST(request:NextRequest){
 try{
  const actor=await engineRouteActor(request);if(!actor.admin)throw new EngineAccessError('Administrator access required',403);
  requireSameOrigin(request);
  const db=await getDb();
  const [existing]=await db.select().from(worldLibraryAssets).where(eq(worldLibraryAssets.slug,STOREFRONT.slug)).limit(1);
  const status=process.env.VERCEL_ENV==='production'?'published':'draft';
  if(existing){
   if(existing.id!==STOREFRONT.id)return NextResponse.json({error:'This slug is already used by another asset.'},{status:409});
   if(status==='published'&&existing.status==='draft')await db.update(worldLibraryAssets).set({status:'published'}).where(eq(worldLibraryAssets.id,existing.id));
   return NextResponse.json({success:true,alreadyExists:true,id:existing.id,tokenPrice:existing.tokenPrice,status});
  }
  await db.insert(worldLibraryAssets).values({id:STOREFRONT.id,slug:STOREFRONT.slug,name:STOREFRONT.name,category:'building',
   description:'Three-floor open-plan storefront with furnishing and wall-art attachment points. Includes use in your owned worlds.',
   modelUrl:STOREFRONT.modelUrl,previewImageUrl:STOREFRONT.previewImageUrl,manifestUrl:STOREFRONT.manifestUrl,
   tokenPrice:STOREFRONT.tokenPrice,status,isPlatformOnly:false,isActive:true});
  return NextResponse.json({success:true,id:STOREFRONT.id,tokenPrice:STOREFRONT.tokenPrice,status},{status:201});
 }catch(error){return NextResponse.json({error:error instanceof EngineAccessError?error.message:'Listing was not created. Retry after checking catalog storage.'},{status:error instanceof EngineAccessError?error.status:503});}
}
