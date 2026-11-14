/** Keep one-off prerequisites explicit while preserving the existing normal build. */
const {spawnSync}=require('node:child_process');
(async()=>{
 const mode=process.env.STADIUM_TEST_SETUP_MODE;
 if(mode==='check'||mode==='apply')await require('./prepare-stadium-test.cjs').prepare();
 else if(process.env.GREEN_TERRAIN_SCHEMA_APPLY==='1')await require('./apply-green-terrain-layout-schema.cjs').apply();
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{stdio:'inherit',env:process.env});
 process.exitCode=result.status??1;
})().catch(e=>{console.error('Deployment prerequisite failed; build stopped. '+(e?.code||'SETUP_ERROR'));process.exitCode=1});
