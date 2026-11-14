import {createHash} from 'node:crypto';
import {EncryptJWT,jwtDecrypt} from 'jose';
import {getConnection} from '@/lib/db';
import type {EngineRouteActor} from '@/lib/security/engine-route-access';
import {presenceScope} from './presence-store';
export const PORTRAIT_PATH='/api/troo-world/presence/portrait?ref=';
type Owner={userId:number;admin:boolean;username?:string};
const audience='troo-stadium-profile-image';
const key=()=>{const secret=process.env.JWT_SECRET?.trim();if(!secret)throw Error('Profile image service is not configured');return createHash('sha256').update(audience+'\0'+secret).digest();};
/** Only the existing, bounded mobile upload format is served; never a server URL fetch. */
export function mobilePortraitBytes(value:unknown):Buffer|null{
 if(typeof value!=='string'||value.length>350000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return null;
 const b=Buffer.from(value.slice(22),'base64');if(b.length<45||b.length>262144||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.readUInt32BE(8)!==13||b.toString('ascii',12,16)!=='IHDR'||b.subarray(-8,-4).toString()!=='IEND')return null;
 const w=b.readUInt32BE(16),h=b.readUInt32BE(20);return w>0&&h>0&&w<=512&&h<=512?b:null;
}
async function read(owner:Owner){
 const db=await getConnection();
 if(owner.admin){if(!owner.username)return null;const [rows]=await db.execute('SELECT avatar_data AS avatarData FROM mobile_administrator_profiles WHERE administrator_username = ? LIMIT 1',[owner.username]);return mobilePortraitBytes((rows as {avatarData:unknown}[])[0]?.avatarData);}
 const [rows]=await db.execute('SELECT avatar_data AS avatarData FROM mobile_member_profiles WHERE member_id = ? LIMIT 1',[owner.userId]);return mobilePortraitBytes((rows as {avatarData:unknown}[])[0]?.avatarData);
}
export async function portraitFor(actor?:EngineRouteActor):Promise<{portraitUrl?:string;portraitStatus:'ready'|'missing'|'unavailable'}>{
 if(!actor)return{portraitStatus:'missing'};
 try{const bytes=await read(actor);if(!bytes)return{portraitStatus:'missing'};
  // The capability contains encrypted account coordinates, never the image or a public account ID.
  const ref=await new EncryptJWT({userId:actor.userId,admin:actor.admin,...(actor.admin?{username:actor.username}:{}),scope:presenceScope(),hash:createHash('sha256').update(bytes).digest('hex')}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setAudience(audience).setIssuedAt().setExpirationTime('24h').encrypt(key());
  return{portraitUrl:PORTRAIT_PATH+ref,portraitStatus:'ready'};
 }catch(e){if((e as {code?:string})?.code==='ER_NO_SUCH_TABLE')return{portraitStatus:'unavailable'};throw e;}
}
export async function resolvePortrait(ref:unknown):Promise<Buffer|null>{
 if(typeof ref!=='string'||ref.length>1600)return null;
 try{const{payload:p}=await jwtDecrypt(ref,key(),{audience,keyManagementAlgorithms:['dir'],contentEncryptionAlgorithms:['A256GCM']});
  if(p.scope!==presenceScope()||!Number.isSafeInteger(p.userId)||Number(p.userId)<1||typeof p.admin!=='boolean'||typeof p.hash!=='string'||!/^[a-f0-9]{64}$/.test(p.hash)||p.admin&&(typeof p.username!=='string'||!p.username||p.username.length>100))return null;
  const bytes=await read({userId:Number(p.userId),admin:p.admin,username:typeof p.username==='string'?p.username:undefined});return bytes&&createHash('sha256').update(bytes).digest('hex')===p.hash?bytes:null;
 }catch{return null;}
}
