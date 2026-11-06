const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const deps=process.env.TOWN_TEST_DEPS||'/workspace/scratch/afbf3881614c/service/node_modules';
const esbuild=require(deps+'/esbuild'),root=path.resolve(__dirname,'../..');
(async()=>{
 const out=fs.mkdtempSync(os.tmpdir()+'/town-ui-');
 const result=await esbuild.build({absWorkingDir:root,entryPoints:['src/components/green-terrain/GreenTerrainExperience.tsx','src/app/troo-town/page.tsx','src/app/green-terrain/page.tsx'],outdir:out,bundle:true,platform:'browser',format:'esm',jsx:'automatic',packages:'external',write:false,metafile:true,logLevel:'warning',tsconfigRaw:{compilerOptions:{baseUrl:'.',paths:{'@/*':['./src/*']}}}});
 if(!Object.keys(result.metafile.inputs).some(p=>p.endsWith('GreenTerrainExperience.tsx')))throw Error('Shared scene was not bundled');
 console.log('Shared editor/public UI and all reachable local TS/TSX modules bundled successfully; third-party packages external.');
})().catch(e=>{console.error(e.message);process.exit(1)});
