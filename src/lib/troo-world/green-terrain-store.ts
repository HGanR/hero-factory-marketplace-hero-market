import {eq} from 'drizzle-orm';
import {getDb} from '@/lib/db';
import {trooWorldPlacements,trooWorldElements} from '@/lib/db/schema';
import {greenTerrainLayouts} from '@/lib/db/schema.green-terrain';
import {GREEN_WORLD_ID,validateLayout,legacyLayout,type GreenLayout} from './green-terrain-layout';
export class LayoutConflict extends Error {}
export async function loadGreenLayout(){
 const db=await getDb();const [row]=await db.select().from(greenTerrainLayouts).where(eq(greenTerrainLayouts.worldId,GREEN_WORLD_ID)).limit(1);
 if(row)return{worldId:GREEN_WORLD_ID,revision:row.revision,layout:validateLayout(row.layout),updatedAt:row.updatedAt};
 // Read the legacy GREEN bucket only. Public GET never seeds, migrates or copies default.
 const placements=await db.select().from(trooWorldPlacements).where(eq(trooWorldPlacements.worldId,GREEN_WORLD_ID));
 const elements=await db.select().from(trooWorldElements).where(eq(trooWorldElements.worldId,GREEN_WORLD_ID));
 return placements.length||elements.length?{worldId:GREEN_WORLD_ID,revision:0,layout:legacyLayout(placements,elements),updatedAt:null}:null;
}
export async function saveGreenLayout(layout:GreenLayout,expectedRevision:number){
 // A complete scene + presentation switches are committed together, never partial placement writes.
 const valid=validateLayout(layout);const db=await getDb();
 return db.transaction(async tx=>{
  const [old]=await tx.select().from(greenTerrainLayouts).where(eq(greenTerrainLayouts.worldId,GREEN_WORLD_ID)).limit(1).for('update');
  if((old?.revision??0)!==expectedRevision)throw new LayoutConflict('Another administrator saved this world. Reload before saving.');
  const revision=expectedRevision+1;
  if(old)await tx.update(greenTerrainLayouts).set({layout:valid,revision,updatedAt:new Date()}).where(eq(greenTerrainLayouts.worldId,GREEN_WORLD_ID));
  else await tx.insert(greenTerrainLayouts).values({worldId:GREEN_WORLD_ID,layout:valid,revision});
  return{worldId:GREEN_WORLD_ID,revision};
 });
}
