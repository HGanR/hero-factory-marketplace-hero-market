/** One-off preview readiness/apply. Never called by runtime requests. No credentials are logged. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),mysql=require('mysql2/promise');
const PROJECT='prj_B7rs60pWcsE3PYUSL97DJ2qFZqFh',BRANCH='feat/jarvon-avatar-proximity-20261114';
const reviewed={
 'troo-avatar-presence.sql':'bbaecda43aac3c304fbcb355753c22bf0f59d9995becfd862ebdcc7b306c99d4',
 'stadium-speaker-floor.sql':'465f66839cd2d0ebec6a8fdb0a0a349156e99f70c7a06f89faad4439001a3ae4',
 'stadium-event-challenges.sql':'c088a75bc2ba85e3507a799116f3953b06ad7cb1389be2e586f6124c69e6d6d1',
};
const shapes={
 troo_avatar_assignments:{columns:{scope:'varchar(48)',avatarId:'varchar(32)',userId:'bigint unsigned'},unique:[['scope','avatarId'],['scope','userId']]},
 troo_stadium_seats:{columns:{scope:'varchar(48)',roomKey:'char(64)',identityKey:'varchar(80)',eventId:'varchar(64)',policyHash:'char(64)',seatIndex:'smallint unsigned',nonceHash:'char(64)',expiresAt:'bigint'},unique:[['scope','roomKey','identityKey'],['scope','roomKey','seatIndex'],['scope','nonceHash']]},
 troo_stadium_floor:{columns:{scope:'varchar(48)',roomKey:'char(64)',hostIdentity:'varchar(80)',hostSeatIndex:'smallint unsigned',speakerIdentity:'varchar(80)',turnId:'char(64)',invitedIdentity:'varchar(80)',inviteId:'char(64)',inviteExpiresAt:'bigint',revision:'bigint unsigned'},unique:[['scope','roomKey']]},
 stadium_event_challenges:{columns:{id:'char(64)',wallet:'char(42)',eventId:'varchar(64)',policyHash:'char(64)',message:'text',expiresAt:'bigint'},unique:[['id']]},
};
class SetupError extends Error{constructor(code){super(code);this.code=code;}}
function guard(env){if(!['check','apply'].includes(env.STADIUM_TEST_SETUP_MODE)||env.VERCEL!=='1'||env.VERCEL_ENV!=='preview'||env.VERCEL_PROJECT_ID!==PROJECT||env.VERCEL_GIT_COMMIT_REF!==BRANCH)throw new SetupError('PREVIEW_GATE_REQUIRED');}
function connectionOptions(env){const raw=env.DATABASE_URL;if(!raw)throw new SetupError('DATABASE_NOT_CONFIGURED');let u;try{u=new URL(raw.includes('://')?raw:'mysql://'+raw)}catch{throw new SetupError('DATABASE_URL_INVALID')}
 if(!['mysql:','mysql2:'].includes(u.protocol))throw new SetupError('DATABASE_URL_INVALID');const tls=/tidbcloud|\.tidb\.io$/i.test(u.hostname)||['1','true','required'].includes(env.DATABASE_SSL);
 return{host:u.hostname,port:Number(u.port||3306),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:decodeURIComponent(u.pathname.slice(1)),connectTimeout:15000,...(tls?{ssl:{rejectUnauthorized:true}}:{})};
}
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function hasTable(db,name){const[rows]=await db.execute('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',[name]);return Number(rows[0].n)>0;}
async function worldDigest(db){if(!await hasTable(db,'green_terrain_layouts'))return null;const[rows]=await db.query('SELECT worldId,revision,SHA2(CAST(layout AS CHAR),256) AS digest FROM green_terrain_layouts ORDER BY worldId');return hash(JSON.stringify(rows));}
function normalType(type){return String(type).toLowerCase().replace(/\b(bigint|smallint|int)\(\d+\)/g,'$1');}
async function inspectTable(db,name){if(!await hasTable(db,name))return'missing';const[columns]=await db.query('SHOW COLUMNS FROM `'+name+'`'),[indexes]=await db.query('SHOW INDEX FROM `'+name+'`');const expected=shapes[name];
 for(const[field,type]of Object.entries(expected.columns))if(!columns.some(c=>c.Field===field&&normalType(c.Type)===type))throw new SetupError('SCHEMA_MISMATCH_'+name);
 const unique=new Map();for(const i of indexes)if(Number(i.Non_unique)===0){if(!unique.has(i.Key_name))unique.set(i.Key_name,[]);unique.get(i.Key_name)[Number(i.Seq_in_index)-1]=i.Column_name;}
 for(const key of expected.unique)if(![...unique.values()].some(fields=>JSON.stringify(fields)===JSON.stringify(key)))throw new SetupError('INDEX_MISMATCH_'+name);
 return'ready';
}
async function prepare(env=process.env){
 guard(env);const files=Object.entries(reviewed).map(([name,sha])=>{const sql=fs.readFileSync(path.join(__dirname,'../sql',name),'utf8');if(hash(sql)!==sha)throw new SetupError('REVIEWED_SCHEMA_CHANGED');return sql;});
 const db=await mysql.createConnection(connectionOptions(env));let report;
 try{const before=await worldDigest(db);const initial={};for(const name of Object.keys(shapes))initial[name]=await inspectTable(db,name);
  if(env.STADIUM_TEST_SETUP_MODE==='apply')for(const sql of files)for(const statement of sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean))await db.query(statement);
  const tables={};for(const name of Object.keys(shapes))tables[name]=await inspectTable(db,name);if(env.STADIUM_TEST_SETUP_MODE==='apply'&&Object.values(tables).some(s=>s!=='ready'))throw new SetupError('TABLES_NOT_READY');
  if(before!==await worldDigest(db))throw new SetupError('WORLD_CHANGED_DURING_SETUP');
  const profiles={};for(const name of ['mobile_member_profiles','mobile_administrator_profiles'])profiles[name]=await hasTable(db,name)?'present':'missing';
  const required=['LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET'],missing=required.filter(key=>!env[key]?.trim());let voice=missing.length?'not-configured':'configured';
  if(!missing.length){try{const {RoomServiceClient}=require('livekit-server-sdk');const service=new RoomServiceClient(env.LIVEKIT_URL.replace(/^ws/,'http'),env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET,{requestTimeout:10});await service.listRooms();voice='reachable'}catch{voice='unreachable'}}
  report={mode:env.STADIUM_TEST_SETUP_MODE,created:Object.keys(tables).filter(n=>initial[n]==='missing'&&tables[n]==='ready'),tables,profiles,savedWorldUnchanged:true,voice,missingVoiceKeys:missing};
  console.log('STADIUM_TEST_SETUP '+JSON.stringify(report));return report;
 }finally{await db.end();}
}
if(require.main===module)prepare().catch(e=>{console.error('STADIUM_TEST_SETUP_FAILED '+(e instanceof SetupError?e.code:'DATABASE_OR_SETUP_ERROR')+'; connection details redacted.');process.exitCode=1});
module.exports={prepare,guard,connectionOptions};
