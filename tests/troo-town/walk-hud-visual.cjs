/** Responsive HUD geometry and held movement, without any real account or microphone. */
const path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const deps=process.env.TOWN_TEST_DEPS,esbuild=require(deps+'/esbuild'),{chromium}=require(deps+'/playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const result=await esbuild.build({stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import Touch from './src/components/green-terrain/TouchWalkControls';import Voice from './src/components/green-terrain/TownVoicePanel';const input={current:{forward:0,strafe:0}};window.input=input;const noop=()=>{};const value={profile:{portraitUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54"><rect width="54" height="54" fill="cyan"/></svg>',voiceConfigured:true},connected:true,mic:false,peers:[],identity:{role:'visitor'},microphone:noop,enableAudio:noop,leave:noop};createRoot(document.getElementById('root')).render(<><Touch input={input} active/><Voice value={value as any} active/></>);`},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',nodePaths:[deps],tsconfigRaw:{compilerOptions:{baseUrl:root,paths:{'@/*':['src/*']}}}});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?result.outputFiles[0].text:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><body style="margin:0"><div id="root"></div><script src="/app.js"></script>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();
 for(const viewport of [{width:320,height:568},{width:390,height:664},{width:844,height:390},{width:1280,height:720}]){
 await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:'+server.address().port);const nav=page.getByRole('navigation',{name:'Walk around controls'}),voice=page.getByRole('region',{name:'Avatar and nearby voice'});await nav.waitFor();await voice.getByAltText('Your stadium profile image').waitFor();
 const boxes=[];for(const item of [nav,voice,...['Move forward','Move backward','Move left','Move right'].map(name=>page.getByRole('button',{name,exact:true}))]){const b=await item.boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+.5&&b.y+b.height<=viewport.height+.5,JSON.stringify({viewport,b}));boxes.push(b)}
 const[a,b]=boxes;assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'Voice card must not cover arrows');
 const button=page.getByRole('button',{name:'Move forward',exact:true});await button.hover();await page.mouse.down();assert.equal(await page.evaluate(()=>window.input.current.forward),1);await page.mouse.up();assert.equal(await page.evaluate(()=>window.input.current.forward),0);
 await page.getByRole('button',{name:'Enable microphone',exact:true}).click();console.log('Visible, separate, interactive HUD:',viewport.width,viewport.height);
 }
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
