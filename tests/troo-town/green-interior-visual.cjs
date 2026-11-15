const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),esbuild=require('esbuild'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'green-interior-artifacts');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const built=await esbuild.build({entryPoints:[root+'/tests/troo-town/green-interior-visual-entry.tsx'],bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',nodePaths:[process.env.TOWN_TEST_DEPS],tsconfigRaw:{compilerOptions:{baseUrl:root,paths:{'@/*':['src/*']}}},plugins:[{name:'next-dynamic-browser',setup(build){build.onResolve({filter:/^wagmi$/},()=>({path:'wallet',namespace:'test-wallet'}));build.onLoad({filter:/.*/,namespace:'test-wallet'},()=>({loader:'js',contents:"export const useAccount=()=>({});export const useConnect=()=>({connectors:[]});export const useSwitchChain=()=>({});export const useSignMessage=()=>({});"}));build.onResolve({filter:/^next\/dynamic$/},()=>({path:'dynamic',namespace:'test-dynamic'}));build.onLoad({filter:/.*/,namespace:'test-dynamic'},()=>({loader:'js',resolveDir:root,contents:"import {lazy} from 'react';export default function dynamic(load){return lazy(load)}"}));}}]});
 const ids=['nexus-tower','meridian-tower','troothhertz-tower','stadium-elyseum','veritas-school'];
 let layout={version:1,buildings:Object.fromEntries(ids.map(id=>[id,{position:[-25,0,0],scale:1,rotationY:0,visible:false}])),trees:[],objects:[],imports:[{elementKey:'office-a',glbUrl:'/models/world-assets/storefront-v2/storefront_v2.glb',position:[18,0,18],scale:1,rotationY:.3}],ambient:{enabled:false,sidewalks:false}},revision=12,writes=0;
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
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'Enter the Building',exact:true}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'Interior',exact:true}).click();await page.getByRole('button',{name:'Select Level 1 Office Bldg',exact:true}).click();
  await page.getByLabel('Location',{exact:true}).selectOption('SLOT_furniture_F1_02');await page.getByRole('button',{name:'Add to building',exact:true}).click();
  await page.getByRole('button',{name:/Save$/,exact:false}).filter({hasText:'Save'}).first().click();
  const size=page.getByLabel('Level 1 Office Bldg size slider',{exact:true});await size.waitFor();await size.focus();await size.press('Home');for(let n=0;n<9;n++)await size.press('ArrowRight');assert.ok(Math.abs(Number(await size.inputValue())-.5)<.001);
  const save=page.getByRole('button',{name:/Save World Layout/});await save.click();await page.waitForFunction(()=>document.body.textContent.includes('Saved revision 13'));
  assert.equal(layout.imports[0].scale,.5);assert.equal(layout.imports[0].interior[0].kind,'desk');assert.equal(writes,1);
  await page.screenshot({path:out+'/office-selected-and-scaled.png'});
  await page.getByRole('button',{name:'Enter the Building',exact:true}).click();await page.getByRole('button',{name:/Exit Building/}).waitFor({timeout:30000});await page.screenshot({path:out+'/office-entered.png'});
  await page.getByRole('button',{name:/Exit Building/}).click();await page.getByRole('button',{name:'Enter the Building',exact:true}).waitFor({timeout:30000});
  await page.reload();await page.getByRole('button',{name:'Enter the Building',exact:true}).waitFor({timeout:60000});await page.getByRole('button',{name:'Interior',exact:true}).click();await page.getByRole('button',{name:'Select Level 1 Office Bldg',exact:true}).click();await page.getByRole('button',{name:'Remove',exact:true}).waitFor();assert.deepEqual(errors,[]);
  console.log('Actual Green Terrain scene: office name/HUD, exclusive selection, admin interior editing without purchase, half-size slider, saved reload, enter and exit all passed.');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
