/** Disposable loopback database; catalog row registration only, no production connection. */
const test=require('node:test'),assert=require('node:assert/strict');
const mysql=require(process.env.TOWN_TEST_DEPS+'/mysql2/promise'),{register}=require('../../scripts/register-level2-store.cjs'),asset=require('../../src/lib/world-assets/level2-store.json');
test('registers the exact paid catalog row once, preserving other listings and later admin edits',async()=>{
 const u=new URL(process.env.TOWN_SQL_URL);if(!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname!=='/town_layout_test')throw Error('Disposable loopback database required');const db=await mysql.createConnection(u.href);
 try{await db.execute('CREATE TABLE IF NOT EXISTS world_library_assets(id VARCHAR(36) PRIMARY KEY,slug VARCHAR(80) UNIQUE,name VARCHAR(120),category VARCHAR(60),description TEXT,status VARCHAR(20),modelUrl VARCHAR(512),previewImageUrl VARCHAR(512),manifestUrl VARCHAR(512),tokenPrice INT,isPlatformOnly BOOLEAN,isActive BOOLEAN)');
 await db.execute('INSERT INTO world_library_assets(id,slug,modelUrl,tokenPrice,status) VALUES(?,?,?,?,?)',['fixture-original','fixture-original','/original.glb',5,'published']);
 assert.deepEqual(await register(db),{created:true});assert.deepEqual(await register(db),{created:false});let[rows]=await db.execute('SELECT * FROM world_library_assets WHERE id=?',[asset.id]);assert.equal(rows[0].tokenPrice,2000000);assert.equal(rows[0].status,'published');assert.equal(rows[0].isPlatformOnly,0);assert.equal(rows[0].name,asset.name);assert.equal(rows[0].modelUrl,asset.modelUrl);
 await db.execute('UPDATE world_library_assets SET tokenPrice=1999999,status=? WHERE id=?',['archived',asset.id]);await register(db);[rows]=await db.execute('SELECT tokenPrice,status FROM world_library_assets WHERE id=?',[asset.id]);assert.equal(rows[0].tokenPrice,1999999);assert.equal(rows[0].status,'archived');[rows]=await db.execute('SELECT tokenPrice FROM world_library_assets WHERE id=?',['fixture-original']);assert.equal(rows[0].tokenPrice,5);
 }finally{await db.end()}
});
