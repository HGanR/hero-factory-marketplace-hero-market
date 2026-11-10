import { createHash, randomUUID } from 'node:crypto';
import type { Placement } from '@/lib/world-engine/chunk-utils';
import { placementsToChunks } from '@/lib/world-engine/chunk-utils';
export interface WorldConnection { execute(sql: string, values?: any[]): Promise<any>; }
export class WorldError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function validatePlacements(value: unknown): Placement[] {
  if (!Array.isArray(value) || value.length > 2000) throw new WorldError('A world supports up to 2,000 placements in this editor.');
  const ids = new Set<string>();
  return value.map(p => {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id || p.id.length > 128 || ids.has(p.id) || typeof p.assetId !== 'string' || !p.assetId || p.assetId.length > 128) throw new WorldError('Invalid or duplicate asset placement.');
    ids.add(p.id);
    for (const key of ['position','rotation','scale']) {
      if (!Array.isArray(p[key]) || p[key].length !== 3 || p[key].some((v: unknown) => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1_000_000 || (key === 'scale' && (v <= 0 || v > 1000)))) throw new WorldError('Enter valid position, rotation and positive scale values.');
    }
    return {id:p.id, assetId:p.assetId, position:p.position, rotation:p.rotation, scale:p.scale, ownerLayer:'user'};
  });
}
export function worldAddress(id: string) { return `https://troothhurtz.app/worlds/${encodeURIComponent(id)}`; }
export async function ownedWorld(db: WorldConnection, memberId: number, id: string, lock = false) {
  const [rows] = await db.execute('SELECT id, name, visibility, status FROM worlds WHERE id = ? AND ownerId = ? AND status <> ? LIMIT 1'+(lock ? ' FOR UPDATE' : ''), [id,memberId,'archived']);
  if (!rows[0]) throw new WorldError('World not found for this member.',404);
  return rows[0];
}
async function snapshot(db: WorldConnection, id: string) {
  const [versions] = await db.execute('SELECT id FROM world_versions WHERE worldId = ? AND versionType = ? ORDER BY versionNumber DESC LIMIT 1',[id,'draft']);
  if (!versions[0]) throw new WorldError('Saved world is unavailable. Existing placements have been preserved.',503);
  const [chunks] = await db.execute('SELECT chunkKey, placementsJson FROM world_chunk_placements WHERE worldVersionId = ? ORDER BY chunkKey',[versions[0].id]);
  const normalized = chunks.map((c: any) => ({chunkKey:c.chunkKey,placementsJson:typeof c.placementsJson === 'string' ? JSON.parse(c.placementsJson) : c.placementsJson}));
  if (normalized.some((c: any) => !Array.isArray(c.placementsJson))) throw new WorldError('Saved placements could not be loaded.',503);
  const revision = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  return {versionId:versions[0].id, placements:normalized.flatMap((c: any)=>c.placementsJson), revision};
}
export async function readWorld(db: WorldConnection, memberId: number, id: string) {
  const world = await ownedWorld(db,memberId,id);
  const state = await snapshot(db,id);
  const [assets] = await db.execute('SELECT a.id, a.name, a.category, u.licenseScope, u.workspaceId, u.remainingPlacements FROM user_world_assets u INNER JOIN world_library_assets a ON a.id = u.assetId WHERE u.userId = ?', [memberId]);
  return {world:{...world,shareUrl:worldAddress(world.id)},...state,assets:assets.filter((a: any)=>a.licenseScope !== 'one_world' || a.workspaceId === id)};
}
// Caller owns a dedicated transaction, including the world row lock and revision check.
export async function writeWorld(db: WorldConnection, memberId: number, id: string, body: Record<string, unknown>) {
  await ownedWorld(db,memberId,id,true);
  const state = await snapshot(db,id);
  if (body.revision !== state.revision) throw new WorldError('This world changed in another session. Reload it before saving; your current edits remain on screen.',409);
  if (body.action === 'visibility') {
    if (!['private','public','unlisted'].includes(String(body.visibility))) throw new WorldError('Choose a supported visitor setting.');
    await db.execute('UPDATE worlds SET visibility = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ? AND ownerId = ?',[body.visibility,id,memberId]);
  } else if (body.action === 'save') {
    const placements = validatePlacements(body.placements);
    const [owned] = await db.execute('SELECT assetId, licenseScope, workspaceId, remainingPlacements FROM user_world_assets WHERE userId = ?',[memberId]);
    const allowed = new Set(owned.filter((a: any)=>a.licenseScope !== 'one_world' || a.workspaceId === id).map((a: any)=>a.assetId));
    if (placements.some(p=>!allowed.has(p.assetId))) throw new WorldError('Only assets owned and licensed for this world can be placed.',403);
    for (const license of owned) if (license.licenseScope === 'quantity_based' && license.remainingPlacements != null && placements.filter(p=>p.assetId===license.assetId).length > license.remainingPlacements) throw new WorldError('The placement count exceeds this asset license.',403);
    await db.execute('DELETE FROM world_chunk_placements WHERE worldVersionId = ?',[state.versionId]);
    for (const chunk of placementsToChunks(placements)) await db.execute('INSERT INTO world_chunk_placements (id, worldVersionId, chunkKey, placementsJson) VALUES (?, ?, ?, ?)',[randomUUID(),state.versionId,chunk.chunkKey,JSON.stringify(chunk.placementsJson)]);
    await db.execute('UPDATE world_versions SET updatedAt = UTC_TIMESTAMP() WHERE id = ?',[state.versionId]);
    await db.execute('UPDATE worlds SET updatedAt = UTC_TIMESTAMP() WHERE id = ? AND ownerId = ?',[id,memberId]);
  } else if (body.action === 'publish') {
    const [versions] = await db.execute('SELECT id FROM world_versions WHERE worldId = ? AND versionType = ? ORDER BY versionNumber DESC LIMIT 1',[id,'published']);
    const versionId = versions[0]?.id ?? randomUUID();
    if (!versions[0]) await db.execute('INSERT INTO world_versions (id, worldId, versionType, versionNumber) VALUES (?, ?, ?, 1)',[versionId,id,'published']);
    await db.execute('DELETE FROM world_chunk_placements WHERE worldVersionId = ?',[versionId]);
    // Copy the saved draft without interpreting or silently dropping legacy placements.
    const [chunks] = await db.execute('SELECT chunkKey, placementsJson FROM world_chunk_placements WHERE worldVersionId = ? ORDER BY chunkKey',[state.versionId]);
    for (const chunk of chunks) await db.execute('INSERT INTO world_chunk_placements (id, worldVersionId, chunkKey, placementsJson) VALUES (?, ?, ?, ?)',[randomUUID(),versionId,chunk.chunkKey,typeof chunk.placementsJson === 'string' ? chunk.placementsJson : JSON.stringify(chunk.placementsJson)]);
    await db.execute('UPDATE worlds SET status = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ? AND ownerId = ?',['published',id,memberId]);
  } else throw new WorldError('Choose Save My World, publish or visitor access.');
  return readWorld(db,memberId,id);
}
