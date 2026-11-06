/** Explicit one-off deployment prerequisite. Never called by the normal build or runtime. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),mysql=require('mysql2/promise');
async function apply(){
 if(process.env.GREEN_TERRAIN_SCHEMA_APPLY!=='1'||process.env.VERCEL!=='1'||process.env.VERCEL_PROJECT_ID!=='prj_B7rs60pWcsE3PYUSL97DJ2qFZqFh')throw Error('Schema apply requires the explicit hero-market deployment gate.');
 const raw=process.env.DATABASE_URL;if(!raw)throw Error('Configured database connection is unavailable.');
 const url=new URL(raw);if(!['mysql:','mysql2:'].includes(url.protocol))throw Error('Unsupported database connection.');
 const tls=/tidbcloud|\.tidb\.io$/i.test(url.hostname)||['1','true','required'].includes(process.env.DATABASE_SSL);
 const options={host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:decodeURIComponent(url.pathname.slice(1)),connectTimeout:15000,...(tls?{ssl:{rejectUnauthorized:true}}:{})};
 const sql=fs.readFileSync(path.join(__dirname,'../sql/green-terrain-layouts.sql'),'utf8');
 if(crypto.createHash('sha256').update(sql).digest('hex')!=='4ca17063393698636749b8ce778a6c4aa55449eb1096ddb1877b16f9a147b3f8')throw Error('Reviewed schema file changed.');
 const conn=await mysql.createConnection(options);
 try{
  const counts=async()=>{const [rows]=await conn.query("SELECT worldId,COUNT(*) AS count FROM troo_world_placements WHERE worldId IN ('green-terrain','default') GROUP BY worldId ORDER BY worldId");return JSON.stringify(rows)};
  const before=await counts();await conn.query(sql);
  const [columns]=await conn.query('SHOW COLUMNS FROM green_terrain_layouts');
  if(!['worldId','revision','layout','updatedAt'].every(name=>columns.some(c=>c.Field===name))||!columns.some(c=>c.Field==='worldId'&&c.Key==='PRI')||!columns.some(c=>c.Field==='layout'&&c.Type==='json'))throw Error('Snapshot table shape is not the reviewed shape.');
  if(await counts()!==before)throw Error('Legacy placement counts changed during the check; review concurrent edits before release.');
  console.log('Green Terrain snapshot table ready. Existing placement counts unchanged. No saved layout was published by this step.');
 }finally{await conn.end()}
}
if(require.main===module)void apply().catch(()=>{console.error('Green Terrain schema readiness failed. Credentials and database details are redacted; deployment must not be promoted.');process.exitCode=1});
module.exports={apply};
