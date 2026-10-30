// Member profile images are separate from the existing 3D avatar/model records.
// No remote image is downloaded by the server and no schema is created at runtime.
export interface ProfileConnection { execute(sql: string, values?: (string | number | null)[]): Promise<any>; }
export type ProfileField = 'bannerData' | 'avatarData';
export function profileImage(input: unknown, field: ProfileField): string | null {
  if (input === null) return null;
  if (typeof input !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(input)) throw new Error('Choose a PNG image.');
  const encoded = input.slice('data:image/png;base64,'.length);
  const limit = field === 'bannerData' ? 512 * 1024 : 256 * 1024;
  if (encoded.length > Math.ceil(limit / 3) * 4) throw new Error('Image is too large.');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 45 || bytes.length > limit || bytes.toString('base64') !== encoded || bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' || bytes.toString('ascii',12,16) !== 'IHDR' || bytes.readUInt32BE(8) !== 13 || bytes.subarray(-8,-4).toString() !== 'IEND') throw new Error('Image is not a supported PNG.');
  const max = field === 'bannerData' ? 1600 : 512;
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > max || height > max) throw new Error('Image dimensions are too large.');
  return input;
}
export function safeAvatarThumbnail(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  if (/^\/(?!\/)[A-Za-z0-9_./%-]+$/.test(value)) return 'https://troothhurtz.app' + value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export async function readMemberProfile(db: ProfileConnection, memberId: number) {
  const [rows] = await db.execute('SELECT banner_data AS bannerData, avatar_data AS avatarData, updated_at AS updatedAt FROM mobile_member_profiles WHERE member_id = ? LIMIT 1', [memberId]);
  const row = rows[0];
  let selectedAvatar: {name: string | null; thumbnailUrl: string | null} | null = null;
  let avatarAvailable = true;
  try {
    const [avatars] = await db.execute('SELECT displayName, thumbnailUrl FROM avatar_profiles WHERE userId = ? AND isDefault = 1 AND status = ? ORDER BY updatedAt DESC LIMIT 1', [memberId, 'ready']);
    if (avatars[0]) selectedAvatar = {name: avatars[0].displayName, thumbnailUrl: safeAvatarThumbnail(avatars[0].thumbnailUrl)};
  } catch { avatarAvailable = false; }
  const [preferences] = await db.execute('SELECT skin FROM mobile_member_appearance WHERE member_id = ? LIMIT 1', [memberId]);
  const skin = ['gold','dawn','neon'].includes(preferences[0]?.skin) ? preferences[0].skin : 'gold';
  return {skin, bannerData: row?.bannerData ?? null, avatarData: row?.avatarData ?? null, updatedAt: row?.updatedAt ?? null, selectedAvatar, avatarAvailable};
}
export async function saveMemberImage(db: ProfileConnection, memberId: number, field: ProfileField, image: string | null) {
  // field is selected by the route from a fixed two-value allowlist, never interpolated from input.
  const column = field === 'bannerData' ? 'banner_data' : 'avatar_data';
  const [result] = await db.execute(`INSERT INTO mobile_member_profiles (member_id, ${column}, updated_at)
    SELECT id, ?, UTC_TIMESTAMP(3) FROM marketplace_users WHERE id = ? AND isActive = 1 AND isApproved = 1
    ON DUPLICATE KEY UPDATE ${column} = VALUES(${column}), updated_at = UTC_TIMESTAMP(3)`, [image, memberId]);
  if (!result.affectedRows) throw new Error('Member profile could not be saved.');
}
export async function readMemberWorlds(db: ProfileConnection, memberId: number) {
  const [rows] = await db.execute('SELECT id, name, visibility, status FROM worlds WHERE ownerId = ? AND status <> ? ORDER BY updatedAt DESC LIMIT 100', [memberId, 'archived']);
  return rows.map((row: any) => ({id: row.id, name: row.name, visibility: row.visibility, status: row.status}));
}


export function profileSkin(input: unknown): string {
  if (typeof input !== 'string' || !['gold','dawn','neon'].includes(input)) throw new Error('Choose Gold, Dawn or Neon.');
  return input;
}
export async function saveMemberSkin(db: ProfileConnection, memberId: number, input: unknown) {
  const skin = profileSkin(input);
  const [result] = await db.execute(`INSERT INTO mobile_member_appearance (member_id, skin, updated_at)
    SELECT id, ?, UTC_TIMESTAMP(3) FROM marketplace_users WHERE id = ? AND isActive = 1 AND isApproved = 1
    ON DUPLICATE KEY UPDATE skin = VALUES(skin), updated_at = UTC_TIMESTAMP(3)`, [skin,memberId]);
  if (!result.affectedRows) throw new Error('Appearance save could not be confirmed.');
}
