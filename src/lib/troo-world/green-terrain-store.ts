import {eq} from 'drizzle-orm';
import {createHash} from 'node:crypto';
import {getDb} from '@/lib/db';
import {trooWorldPlacements,trooWorldElements} from '@/lib/db/schema';
import {greenTerrainLayouts} from '@/lib/db/schema.green-terrain';
import {GREEN_WORLD_ID,validateLayout,legacyLayout,type GreenLayout} from './green-terrain-layout';
export class LayoutConflict extends Error {}
/** Preview and production may share credentials; new-schema preview saves must
 * never make the older live renderer unable to validate its town snapshot. */
export function greenLayoutBucket(){return process.env.VERCEL_ENV==='preview'?'green-preview-'+createHash('sha256').update(process.env.VERCEL_GIT_COMMIT_REF||process.env.VERCEL_URL||'local-preview').digest('hex').slice(0,16):GREEN_WORLD_ID;}
export async function loadGreenLayout(){
 const db=await getDb(),bucket=greenLayoutBucket(),preview=bucket!==GREEN_WORLD_ID;
 const [row]=await db.select().from(greenTerrainLayouts).where(eq(greenTerrainLayouts.worldId,bucket)).limit(1);
 if(row)return{worldId:GREEN_WORLD_ID,revision:row.revision,layout:validateLayout(row.layout),updatedAt:row.updatedAt,...(preview?{preview:true}:{})};
 if(preview){const [live]=await db.select().from(greenTerrainLayouts).where(eq(greenTerrainLayouts.worldId,GREEN_WORLD_ID)).limit(1);if(live)return{worldId:GREEN_WORLD_ID,revision:0,layout:validateLayout(live.layout),updatedAt:live.updatedAt,preview:true};}
 // Read the legacy GREEN bucket only. Public GET never seeds, migrates or copies default.
 const placements=await db.select().from(trooWorldPlacements).where(eq(trooWorldPlacements.worldId,GREEN_WORLD_ID));
 const elements=await db.select().from(trooWorldElements).where(eq(trooWorldElements.worldId,GREEN_WORLD_ID));
 return placements.length||elements.length?{worldId:GREEN_WORLD_ID,revision:0,layout:legacyLayout(placements,elements),updatedAt:null,...(preview?{preview:true}:{})}:null;
}
export async function saveGreenLayout(layout:GreenLayout,expectedRevision:number){
 // A complete scene + presentation switches are committed together, never partial placement writes.
 const valid=validateLayout(layout);const db=await getDb(),bucket=greenLayoutBucket();
 return db.transaction(async tx=>{
  const [old]=await tx.select().from(greenTerrainLayouts).where(eq(greenTerrainLayouts.worldId,bucket)).limit(1).for('update');
  if((old?.revision??0)!==expectedRevision)throw new LayoutConflict('Another administrator saved this world. Reload before saving.');
  const revision=expectedRevision+1;
  if(old)await tx.update(greenTerrainLayouts).set({layout:valid,revision,updatedAt:new Date()}).where(eq(greenTerrainLayouts.worldId,bucket));
  else await tx.insert(greenTerrainLayouts).values({worldId:bucket,layout:valid,revision});
  return{worldId:GREEN_WORLD_ID,revision};
 });
}

