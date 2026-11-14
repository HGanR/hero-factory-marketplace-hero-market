const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};

test('focus refresh keeps the scene and camera mounted through pending, failed and successful requests',async()=>{
 const dom=new JSDOM('<body></body>',{url:'https://town.test',pretendToBeVisual:true});
 for(const key of ['window','document','HTMLElement','Element','Event'])Object.defineProperty(globalThis,key,{value:key==='window'?dom.window:dom.window[key],configurable:true});
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const React=require('react'),{render,fireEvent,waitFor,act,cleanup}=require('@testing-library/react');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'town-refresh-'));
 const previousFetch=globalThis.fetch,requests=[];
 globalThis.fetch=(url,options)=>{const d=deferred();requests.push({...d,url,options});return d.promise;};
 try{
  await require('esbuild').build({absWorkingDir:root,entryPoints:['src/components/green-terrain/useSavedTownLayout.ts'],outfile:path.join(dir,'hook.cjs'),bundle:true,platform:'node',format:'cjs',packages:'external',tsconfigRaw:{compilerOptions:{baseUrl:'.',paths:{'@/*':['./src/*']}}}});
  await require('esbuild').build({absWorkingDir:root,entryPoints:['src/lib/troo-world/green-terrain-layout.ts'],outfile:path.join(dir,'layout.cjs'),bundle:true,platform:'node',format:'cjs'});
  const {useSavedTownLayout}=require(path.join(dir,'hook.cjs'));
  const {DEFAULT_BUILDINGS}=require(path.join(dir,'layout.cjs'));
  const layout={version:1,buildings:DEFAULT_BUILDINGS,trees:[],objects:[],imports:[],ambient:{enabled:true,sidewalks:true}};
  const reply=(index,body,ok=true)=>act(async()=>requests[index].resolve({ok,json:async()=>body}));
  let mounts=0,unmounts=0,lastTown,latest;
  const accept=town=>{lastTown=town;};
  function Scene(){const[camera,setCamera]=React.useState('original camera');React.useEffect(()=>{mounts++;return()=>{unmounts++;};},[]);return React.createElement('button',{onClick:()=>setCamera('visitor camera')},camera);}
  function Viewer({readOnly=true}){latest=useSavedTownLayout(readOnly,accept);return latest.ready?React.createElement(Scene):React.createElement('p',null,latest.error||'Loading');}
  const screen=render(React.createElement(Viewer));
  await reply(0,{ok:true,revision:3,layout});
  fireEvent.click(screen.getByRole('button',{name:'original camera'}));
  fireEvent(window,new Event('focus'));assert.equal(requests.length,2);
  assert.ok(screen.getByRole('button',{name:'visitor camera'}));assert.equal(unmounts,0);
  await reply(1,{ok:false,error:'Storage temporarily unavailable'},false);
  assert.match(latest.error,/Storage/);assert.equal(latest.ready,true);assert.equal(lastTown.revision,3);assert.equal(unmounts,0);
  act(()=>latest.retry());
  await reply(2,{ok:true,revision:4,layout:{...layout,buildings:{...layout.buildings,'stadium-elyseum':{...layout.buildings['stadium-elyseum'],position:[37,0,37],scale:.4}}}});
  assert.equal(lastTown.revision,4);assert.equal(lastTown.layout.buildings['stadium-elyseum'].scale,.4);
  assert.equal(latest.error,'');assert.ok(screen.getByRole('button',{name:'visitor camera'}));assert.equal(mounts,1);
  // Superseded responses cannot overwrite a more recent focus refresh.
  fireEvent(window,new Event('focus'));fireEvent(window,new Event('focus'));
  assert.equal(requests[3].options.signal.aborted,true);
  await reply(4,{ok:true,revision:6,layout});await reply(3,{ok:true,revision:5,layout});
  assert.equal(lastTown.revision,6);assert.equal(unmounts,0);
  act(()=>latest.retry());await reply(5,{ok:true,revision:7,layout:{version:999}});
  assert.equal(lastTown.revision,6);assert.equal(latest.ready,true);assert.match(latest.error,/Unsupported layout/);
  screen.unmount();assert.equal(unmounts,1);const count=requests.length;fireEvent(window,new Event('focus'));assert.equal(requests.length,count);
  // Editor focus must not reload over unsaved edits. Missing public data fails closed.
  const editor=render(React.createElement(Viewer,{readOnly:false}));await reply(6,{ok:true,missing:true});
  assert.equal(latest.ready,true);fireEvent(window,new Event('focus'));assert.equal(requests.length,7);editor.unmount();
  const missing=render(React.createElement(Viewer));await reply(7,{ok:true,missing:true});
  assert.equal(latest.ready,false);assert.match(latest.error,/No Green Terrain layout/);missing.unmount();
 }finally{cleanup();globalThis.fetch=previousFetch;dom.window.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('optional images dispose failed and late textures and never update an unmounted building',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'town-textures-'));
 try{
  await require('esbuild').build({absWorkingDir:root,entryPoints:['src/components/green-terrain/loadTownTexture.ts'],outfile:path.join(dir,'texture.cjs'),bundle:true,platform:'node',format:'cjs'});
  const {loadTownTexture}=require(path.join(dir,'texture.cjs'));
  for(const mode of ['success','failure','late']){
   let calls=0,disposals=0,loaded,error;const texture={dispose(){disposals++;}};
   const loader={load(url,onLoad,_progress,onError){loaded=onLoad;error=onError;return texture;}};
   const stop=loadTownTexture(loader,'https://images.test/blocked.jpg',()=>calls++);
   if(mode==='success'){loaded(texture);assert.equal(calls,1);stop();}
   if(mode==='failure'){error();assert.equal(calls,0);stop();}
   if(mode==='late'){stop();loaded(texture);assert.equal(calls,0);}
   stop();assert.equal(disposals,1);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

