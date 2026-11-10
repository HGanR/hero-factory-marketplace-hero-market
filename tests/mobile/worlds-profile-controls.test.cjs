const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..');const moduleObject={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/mobile/shell.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:moduleObject,exports:moduleObject.exports});const html=moduleObject.exports.mobileShell;const client=fs.readFileSync(path.join(root,'public/mobile/client.js'),'utf8');
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
async function fixture(){
 const dom=new JSDOM(html,{url:'https://mobile.example/mobile',runScripts:'outside-only',pretendToBeVisual:true});const requests=[];let profile={avatarData:'data:image/png;base64,original',bannerData:null,skin:'gold'};
 dom.window.structuredClone=structuredClone;dom.window.confirm=()=>true;dom.window.createImageBitmap=async()=>({width:200,height:100,close(){}});
 dom.window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});dom.window.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,new-image';
 dom.window.fetch=async(url,options={})=>{requests.push({url,options});let data;
  if(url==='/api/mobile/session')data={user:{id:7,username:'Member',email:'member@example.test'}};
  else if(options.method==='PATCH'){Object.assign(profile,JSON.parse(options.body));data={saved:true,profile};}
  else data={profile,worlds:[{id:'world-1',name:'World One',visibility:'private',status:'draft'}]};
  return {ok:true,status:200,json:async()=>data};};
 dom.window.eval(client);await settle();return {dom,requests,$:id=>dom.window.document.getElementById(id)};
}
test('banner and circular avatar are native buttons wired to the corresponding picker',async()=>{
 const f=await fixture();try{for(const [surface,input] of [['chooseBannerSurface','bannerFile'],['chooseAvatarSurface','avatarFile']]){let opened=0;f.$(input).addEventListener('click',event=>{opened++;event.preventDefault();});assert.equal(f.$(surface).tagName,'BUTTON');assert.ok(f.$(surface).getAttribute('aria-label'));f.$(surface).click();assert.equal(opened,1);}}finally{f.dom.window.close();}
});
test('tapping the displayed image bubbles to its picker and saves the correct member image field',async()=>{
 for(const [surface,input,image,field] of [['chooseBannerSurface','bannerFile','profileBanner','bannerData'],['chooseAvatarSurface','avatarFile','profileAvatar','avatarData']]){
  const f=await fixture();try{f.$(input).addEventListener('click',event=>event.preventDefault());f.$(image).click();const file=new f.dom.window.File(['image'],'photo.png',{type:'image/png'});Object.defineProperty(f.$(input),'files',{value:[file],configurable:true});f.$(input).dispatchEvent(new f.dom.window.Event('change'));await settle();const save=f.requests.find(r=>r.options.method==='PATCH');assert.ok(save);assert.deepEqual(JSON.parse(save.options.body),{[field]:'data:image/png;base64,new-image'});assert.equal(f.$(image).getAttribute('src'),'data:image/png;base64,new-image');assert.equal(f.$(image).hidden,false);}finally{f.dom.window.close();}
 }
});
test('START MY JOURNEY replaces CRM/wallet links and opens the mobile World Explorer',async()=>{
 const f=await fixture();try{const doc=f.dom.window.document;assert.equal(f.$('workspaceJourney').textContent,'START MY JOURNEY→');assert.equal(doc.querySelector('a[href="/app/dashboard"]'),null);assert.equal(doc.querySelector('a[href="/wallet-dashboard"]'),null);assert.equal(doc.querySelector('a[href="/troo-town"]').textContent,'TROO TOWN→');f.$('workspaceJourney').click();assert.equal(f.$('explorer').hidden,false);assert.equal(f.$('profileScreen').hidden,true);assert.equal(f.$('explorerHeading').textContent,'WORLD EXPLORER');assert.doesNotMatch(doc.body.textContent,/The separate mobile explorer, KYC/);}finally{f.dom.window.close();}
});
test('both journey buttons target the same explorer and clearing the account blocks image selection',async()=>{
 const f=await fixture();try{f.$('journeyBtn').click();assert.equal(f.$('explorer').hidden,false);f.$('explorerBack').click();f.$('workspaceJourney').click();assert.equal(f.$('explorer').hidden,false);f.dom.window.dispatchEvent(new f.dom.window.Event('pagehide'));let opened=0;f.$('bannerFile').addEventListener('click',()=>opened++);f.$('chooseBannerSurface').click();assert.equal(opened,0);}finally{f.dom.window.close();}
});
test('cancelled image selection does not replace the saved photo',async()=>{
 const f=await fixture();try{f.$('bannerFile').addEventListener('click',event=>event.preventDefault());f.$('chooseBannerSurface').click();Object.defineProperty(f.$('bannerFile'),'files',{value:[]});f.$('bannerFile').dispatchEvent(new f.dom.window.Event('change'));await settle();assert.equal(f.requests.some(r=>r.options.method==='PATCH'),false);assert.equal(f.$('profileAvatar').getAttribute('src'),'data:image/png;base64,original');}finally{f.dom.window.close();}
});
