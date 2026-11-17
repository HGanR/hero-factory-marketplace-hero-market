const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),esbuild=require('esbuild'),{chromium}=require('playwright');
const level2=process.env.LEVEL2_STORE_TEST==='1',officeName=level2?'Level 2 Store':'Level 1 Office Bldg';
const root=path.resolve(__dirname,'../..'),out=path.join(root,level2?'level2-store-artifacts':'green-interior-artifacts');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const built=await esbuild.build({entryPoints:[root+'/tests/troo-town/green-interior-visual-entry.tsx'],bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',nodePaths:[process.env.TOWN_TEST_DEPS],tsconfigRaw:{compilerOptions:{baseUrl:root,paths:{'@/*':['src/*']}}},plugins:[{name:'next-dynamic-browser',setup(build){build.onResolve({filter:/^wagmi$/},()=>({path:'wallet',namespace:'test-wallet'}));build.onLoad({filter:/.*/,namespace:'test-wallet'},()=>({loader:'js',contents:"export const useAccount=()=>({});export const useConnect=()=>({connectors:[]});export const useSwitchChain=()=>({});export const useSignMessage=()=>({});"}));build.onResolve({filter:/^next\/dynamic$/},()=>({path:'dynamic',namespace:'test-dynamic'}));build.onLoad({filter:/.*/,namespace:'test-dynamic'},()=>({loader:'js',resolveDir:root,contents:"import {lazy} from 'react';export default function dynamic(load){return lazy(load)}"}));}}]});
 const ids=['nexus-tower','meridian-tower','troothhertz-tower','stadium-elyseum','veritas-school'];
 let layout={version:1,buildings:Object.fromEntries(ids.map(id=>[id,{position:[-25,0,0],scale:1,rotationY:0,visible:false}])),trees:[],objects:[],imports:[{elementKey:'office-a',glbUrl:level2?'/models/world-assets/storefront-v3/storefront_v3.glb':'/models/world-assets/storefront-v2/storefront_v2.glb',position:[18,0,18],scale:1,rotationY:.3}],ambient:{enabled:false,sidewalks:false}},revision=12,writes=0;
 const send=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data))};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture.test');
  if(url.pathname==='/app.js'){res.setHeader('Content-Type','application/javascript');return res.end(built.outputFiles[0].contents)}
  if(url.pathname==='/api/troo-world/green-terrain-layout')return send(res,{ok:true,layout,revision,preview:true});
  if(url.pathname==='/api/admin/troo-world/green-terrain-layout'){let raw='';req.on('data',d=>raw+=d);req.on('end',()=>{const body=JSON.parse(raw);assert.equal(body.expectedRevision,revision);layout=body.layout;revision++;writes++;send(res,{ok:true,layout,revision,preview:true})});return;}
  if(url.pathname==='/fixture-state')return send(res,{layout,revision,writes});
  if(url.pathname.includes('/presence'))return send(res,{error:'No voice fixture session'},401);
  if(url.pathname.startsWith('/api/'))return send(res,{worlds:[],elements:[],npcs:[],placements:[]});
  const file=path.resolve(root,'public','.'+decodeURIComponent(url.pathname));
  if(file.startsWith(root+'/public/')&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream');return res.end(fs.readFileSync(file));}
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script src="/app.js"></script></body></html>')}
  res.writeHead(404);res.end();
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|WebGLProgram/.test(m.text()))errors.push(m.text())});
  const selectOffice=async()=>{await page.waitForFunction(()=>window.__officePick?.(),{},{timeout:60000});assert.equal(await page.getByRole('button',{name:'Enter the Building',exact:true}).count(),0);const p=await page.evaluate(()=>window.__officePick());await page.mouse.click(...p);await page.getByRole('button',{name:'Enter the Building',exact:true}).waitFor({timeout:30000})};
  await page.goto('http://127.0.0.1:'+server.address().port);await selectOffice();assert.equal(await page.getByRole('button',{name:/🛗 Call/}).count(),0);assert.equal(await page.getByText('Marcus Chen',{exact:false}).count(),0);
  await page.getByRole('button',{name:'Interior',exact:true}).click();await page.getByRole('button',{name:'Select '+officeName,exact:true}).click();
  await page.getByLabel('Location',{exact:true}).selectOption(level2?'v3_SLOT_furniture_F1_02':'SLOT_furniture_F1_02');await page.getByRole('button',{name:'Add to building',exact:true}).click();
  await page.getByRole('button',{name:/Save$/,exact:false}).filter({hasText:'Save'}).first().click();
  const size=page.getByLabel(officeName+' size slider',{exact:true});await size.waitFor();await size.focus();await size.press('Home');for(let n=0;n<9;n++)await size.press('ArrowRight');assert.ok(Math.abs(Number(await size.inputValue())-.5)<.001);
  const save=page.getByRole('button',{name:/Save World Layout/});await save.click();await page.waitForFunction(()=>document.body.textContent.includes('Saved revision 13'));
  assert.equal(layout.imports[0].scale,.5);assert.equal(layout.imports[0].interior[0].kind,'desk');assert.equal(writes,1);
  await page.screenshot({path:out+'/office-selected-and-scaled.png'});
  await page.getByRole('button',{name:'Enter the Building',exact:true}).click();await page.getByRole('button',{name:/Exit Building/}).waitFor({timeout:30000});await page.screenshot({path:out+'/office-entered.png'});
  await page.getByRole('button',{name:/Exit Building/}).click();await page.getByRole('button',{name:'Enter the Building',exact:true}).waitFor({timeout:30000});
  await page.reload();await selectOffice();await page.getByRole('button',{name:'Interior',exact:true}).click();await page.getByRole('button',{name:'Select '+officeName,exact:true}).click();await page.getByRole('button',{name:'Remove',exact:true}).waitFor();assert.deepEqual(errors,[]);
  console.log('Actual Green Terrain scene: office name/HUD, exclusive selection, admin interior editing without purchase, half-size slider, saved reload, enter and exit all passed.');
  if(!level2){
   await page.getByRole('button',{name:'📦 Library',exact:true}).click();
   for(const name of ['Forest Habitat','TROO Transit Bus']){const card=page.getByText(name,{exact:true}).locator('..').locator('..');await card.getByRole('button',{name:'+ Place',exact:true}).click();}
   await page.waitForFunction(()=>window.__terrainAssetNodes?.().forest&&window.__terrainAssetNodes().bus,null,{timeout:60000});assert.equal(await page.evaluate(()=>window.__terrainAssetNodes().selected),true);
   assert.equal(await page.getByRole('button',{name:/List (Forest Habitat|TROO Transit Bus)/}).count(),0);
   const parked=await page.evaluate(()=>window.__terrainAssetNodes().busPosition);await page.waitForTimeout(700);assert.deepEqual(await page.evaluate(()=>window.__terrainAssetNodes().busPosition),parked);
   await page.getByRole('button',{name:/Save$/,exact:false}).filter({hasText:'Save'}).first().click();await page.getByLabel('Forest Habitat scale',{exact:true}).fill('0.75');await page.getByLabel('TROO Transit Bus scale',{exact:true}).fill('1.1');await save.click();await page.waitForFunction(()=>document.body.textContent.includes('Saved revision 14'));
   const forest=layout.imports.find(p=>p.glbUrl==='/models/green-terrain/forest-habitat.glb'),bus=layout.imports.find(p=>p.glbUrl==='/models/green-terrain/troo-transit-bus.glb');assert.deepEqual(forest.position,[0,0,0]);assert.deepEqual(bus.position,[0,0,0]);assert.equal(forest.scale,.75);assert.equal(bus.scale,1.1);assert.equal(writes,2);await page.screenshot({path:out+'/green-terrain-only-library-models.png',timeout:60000});
   await page.getByLabel('Bus street '+bus.elementKey,{exact:true}).selectOption('east-west');await page.getByLabel('Bus edge mode '+bus.elementKey,{exact:true}).selectOption('shuttle');await page.getByLabel('Bus speed '+bus.elementKey,{exact:true}).fill('4');await save.click();await page.waitForFunction(()=>document.body.textContent.includes('Saved revision 15'));assert.deepEqual(layout.imports.find(p=>p.elementKey===bus.elementKey).transit,{enabled:true,axis:'east-west',mode:'shuttle',speed:4});assert.equal(writes,3);await page.getByLabel('Bus street '+bus.elementKey,{exact:true}).selectOption('both');await save.click();await page.waitForFunction(()=>document.body.textContent.includes('Saved revision 16'));assert.equal(layout.imports.find(p=>p.elementKey===bus.elementKey).transit.axis,'both');assert.equal(writes,4);await page.reload();await page.waitForFunction(()=>window.__terrainAssetNodes?.().forest&&window.__terrainAssetNodes().bus,null,{timeout:60000});assert.deepEqual(errors,[]);console.log('Actual Green Terrain library Place buttons, native forest/bus rendering, selection, parked bus, per-model scale, saved reload and absence of marketplace listing buttons passed.');
  }
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
