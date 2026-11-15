/** Release data registration for the owner's Level 2 Store listing. No schema changes or runtime endpoint. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const asset=require('../src/lib/world-assets/level2-store.json');
const PROJECT='prj_B7rs60pWcsE3PYUSL97DJ2qFZqFh';
function guard(env){if(env.VERCEL!=='1'||env.VERCEL_ENV!=='production'||env.VERCEL_PROJECT_ID!==PROJECT)throw Error('PRODUCTION_CATALOG_RELEASE_REQUIRED');}
async function register(db){
 await db.beginTransaction();try{
  const [existing]=await db.execute('SELECT id,slug,modelUrl,tokenPrice,status FROM world_library_assets WHERE id=? OR slug=? FOR UPDATE',[asset.id,asset.slug]);
  if(existing.length){if(existing.length!==1||existing[0].id!==asset.id||existing[0].slug!==asset.slug||existing[0].modelUrl!==asset.modelUrl)throw Error('CATALOG_IDENTITY_CONFLICT');await db.commit();return{created:false};}
  await db.execute('INSERT INTO world_library_assets (id,slug,name,category,description,status,modelUrl,previewImageUrl,manifestUrl,tokenPrice,isPlatformOnly,isActive) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[asset.id,asset.slug,asset.name,'building',asset.description,'published',asset.modelUrl,asset.previewImageUrl,asset.manifestUrl,asset.tokenPrice,0,1]);
  await db.commit();return{created:true};
 }catch(error){await db.rollback();throw error;}
}
async function release(env=process.env){
 if(env.VERCEL_ENV!=='production')return;
 guard(env);
 const bytes=fs.readFileSync(path.join(__dirname,'../public',asset.modelUrl));
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==EXPECTED_MODEL_SHA256)throw Error('LEVEL2_MODEL_CHANGED');
 const mysql=require('mysql2/promise'),{connectionOptions}=require('./prepare-stadium-test.cjs');
 const db=await mysql.createConnection(connectionOptions(env));try{const result=await register(db);console.log('Level 2 Store catalog registration: '+(result.created?'published at 2,000,000 TROO':'already registered; existing listing preserved'));}finally{await db.end();}
}
const EXPECTED_MODEL_SHA256='62c66e389588fc68c75165675f812189d9fda20818e38c4e142753a57dbf68aa';
module.exports={guard,register,release};
if(require.main===module)release().catch(()=>{console.error('Level 2 Store catalog registration failed; release stopped. Connection details redacted.');process.exitCode=1;});
