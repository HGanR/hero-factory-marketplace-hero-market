import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {profileSkin,saveMemberSkin,readMemberProfile} from '../../src/lib/mobile/profile.ts';
const source=await readFile(new URL('../../public/mobile/client.js',import.meta.url),'utf8');
const flush=()=>new Promise(r=>setImmediate(r));
function harness({image=null,available=true,admin=false,terms=false,failSave=false,delayed=false,selectedAvatar=null}={}) {
 const nodes=new Map(), calls=[];let resolveProfile;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,value:'gold',dataset:{},textContent:'',handlers:{},addEventListener(t,f){this.handlers[t]=f},setAttribute(k,v){this[k]=v;},removeAttribute(){},replaceChildren(){},focus(){},click(){this.handlers.click?.({preventDefault(){}});}});return nodes.get(id)};
 const profile={avatarData:image,selectedAvatar,avatarAvailable:available,skin:'gold'};
 const fetch=async(url,opts)=>{calls.push({url,opts});if(url.includes('/profile')){
  if(delayed && opts.method==='GET')return new Promise(resolve=>{resolveProfile=()=>resolve({ok:true,json:async()=>({profile,worlds:[]})})});
  if(failSave && opts.method==='PATCH')return {ok:false,status:503,json:async()=>({error:'save unavailable'})};
  if(opts.method==='PATCH')Object.assign(profile,JSON.parse(opts.body));
  return {ok:true,json:async()=>({profile:{...profile},worlds:[]})};
 }return {ok:true,json:async()=>terms?{access:'terms_required',terms:{version:'v1',sha256:'a'.repeat(64)}}:{user:{id:7,username:'existing',email:'test@example.invalid',role:admin?'administrator':'member'}}};};
 const context=vm.createContext({document:{getElementById:node,createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/png;base64,fixture'}),body:{dataset:{}},addEventListener(){},hidden:false},window:{addEventListener(){}},navigator:{},createImageBitmap:async()=>({width:64,height:64,close(){}}),fetch,AbortController,setTimeout,clearTimeout,console});
 vm.runInContext(source,context);
 return {node,calls,context,resolve:()=>resolveProfile()};
}
test('skins accept only existing choices and saves are scoped to active approved members',async()=>{
 for(const v of ['gold','dawn','neon'])assert.equal(profileSkin(v),v);
 for(const v of [null,{},'admin','<script>'])assert.throws(()=>profileSkin(v));
 const calls=[];await saveMemberSkin({execute:async(sql,args)=>{calls.push({sql,args});return [{affectedRows:1}]}},7,'dawn');
 assert.deepEqual(calls[0].args,['dawn',7]);assert.match(calls[0].sql,/isActive = 1 AND isApproved = 1/);
 assert.doesNotMatch(calls[0].sql,/UPDATE marketplace_users|avatar_data|banner_data/);
 await assert.rejects(saveMemberSkin({execute:async()=>[{affectedRows:0}]},7,'gold'));
});
test('saved skin reads from the member account',async()=>{
 const p=await readMemberProfile({execute:async(sql,args)=>{assert.equal(args[0],7);return [sql.includes('appearance')?[{skin:'neon'}]:[]]}},7);
 assert.equal(p.skin,'neon');
});
test('member without an image opens setup; existing username preserved; cannot finish without image',async()=>{
 const h=harness();await flush();assert.equal(h.node('appearanceSetup').hidden,false);assert.equal(h.node('profileScreen').hidden,true);assert.equal(h.node('finishSetup').disabled,true);assert.match(h.node('setupUsername').textContent,/existing/);
 await h.node('finishSetup').handlers.click();assert.equal(h.calls.filter(x=>x.opts.method==='PATCH').length,0);
});
test('returning image owner opens profile and can save skin from appearance settings',async()=>{
 const h=harness({image:'data:image/png;base64,fixture'});await flush();assert.equal(h.node('appearanceSetup').hidden,true);assert.equal(h.node('profileScreen').hidden,false);
 h.node('editAppearance').handlers.click();h.node('skinChoice').value='neon';await h.node('finishSetup').handlers.click();
 assert.equal(h.node('appearanceSetup').hidden,true);assert.equal(h.context.document.body.dataset.skin,'neon');assert.equal(JSON.parse(h.calls.at(-1).opts.body).skin,'neon');
});
test('failed skin save retains setup and displays retryable error',async()=>{
 const h=harness({image:'data:image/png;base64,fixture',failSave:true});await flush();h.node('editAppearance').handlers.click();await h.node('finishSetup').handlers.click();assert.equal(h.node('appearanceSetup').hidden,false);assert.equal(h.node('setupMessage').textContent,'save unavailable');
});
test('unavailable avatar service does not force new avatar selection',async()=>{const h=harness({available:false});await flush();assert.equal(h.node('appearanceSetup').hidden,true);assert.equal(h.node('profileScreen').hidden,false)});
test('terms gate precedes profile fetch, administrators bypass member setup',async()=>{
 const terms=harness({terms:true});const admin=harness({admin:true});await flush();assert.equal(terms.node('termsGate').hidden,false);assert.equal(terms.calls.length,1);assert.equal(admin.node('appearanceSetup').hidden,true);assert.equal(admin.calls.length,1);
});
test('late profile response cannot reopen setup after signout',async()=>{
 const h=harness({delayed:true});await flush();await h.node('logout').handlers.click();h.resolve();await flush();assert.equal(h.node('account').hidden,true);assert.equal(h.node('appearanceSetup').hidden,true);
});


test('website avatar selection bypasses first-time image setup',async()=>{
 const h=harness({selectedAvatar:{thumbnailUrl:'https://troothhurtz.app/avatars/chosen.png'}});await flush();
 assert.equal(h.node('appearanceSetup').hidden,true);assert.equal(h.node('profileAvatar').src,'https://troothhurtz.app/avatars/chosen.png');
});
test('native picker selection revalidates a cleared session before saving to its original member',async()=>{
 const h=harness();await flush();const input=h.node('setupAvatarFile');input.handlers.click({preventDefault(){}});
 vm.runInContext('++generation; clearAccount();',h.context);
 input.files=[{type:'image/png',size:100}];await input.handlers.change({target:input});
 const writes=h.calls.filter(x=>x.opts.method==='PATCH');assert.equal(writes.length,1);assert.ok(JSON.parse(writes[0].opts.body).avatarData);
 assert.equal(h.node('finishSetup').disabled,false);
});
test('an image selected for a different account cannot be saved after account switching',async()=>{
 const h=harness();await flush();const input=h.node('setupAvatarFile');input.handlers.click({preventDefault(){}});
 vm.runInContext('currentMember=8;',h.context);input.files=[{type:'image/png',size:100}];await input.handlers.change({target:input});
 assert.equal(h.calls.filter(x=>x.opts.method==='PATCH').length,0);assert.match(h.node('status').textContent,/account changed/);
});

test('a cancelled selection cannot attach to a different account after logout',async()=>{
 const h=harness();await flush();const input=h.node('setupAvatarFile');input.handlers.click({preventDefault(){}});
 await h.node('logout').handlers.click();vm.runInContext('currentMember=8;',h.context);
 input.files=[{type:'image/png',size:100}];await input.handlers.change({target:input});
 assert.equal(h.calls.filter(x=>x.opts.method==='PATCH').length,0);
});

test('keyboard-accessible setup button opens an account-bound image selection',async()=>{
 const h=harness();await flush();h.node('chooseSetupAvatar').handlers.click();
 const input=h.node('setupAvatarFile');input.files=[{type:'image/png',size:100}];await input.handlers.change({target:input});
 assert.equal(h.calls.filter(x=>x.opts.method==='PATCH').length,1);
});

test('profile skin pills preview the skin and Save Profile persists only the skin',async()=>{
 const h=harness({image:'data:image/png;base64,fixture'});await flush();
 h.node('profileSkinDawn').handlers.click();assert.equal(h.context.document.body.dataset.skin,'dawn');assert.equal(h.node('profileSkinDawn')['aria-pressed'],'true');assert.equal(h.calls.filter(x=>x.opts.method==='PATCH').length,0);
 await h.node('saveProfile').handlers.click();const writes=h.calls.filter(x=>x.opts.method==='PATCH');assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0].opts.body),{skin:'dawn'});assert.equal(h.node('profileAvatar').src,'data:image/png;base64,fixture');assert.equal(h.node('appearanceMessage').textContent,'Profile saved.');
});
test('administrator view does not expose member skin saving controls',async()=>{
 const h=harness({admin:true});await flush();assert.equal(h.node('profileAppearance').hidden,true);assert.equal(h.node('saveProfile').hidden,true);await h.node('saveProfile').handlers.click();assert.equal(h.calls.filter(x=>x.opts.method==='PATCH').length,0);
});
