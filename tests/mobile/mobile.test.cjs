const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../..');
function load(file,imports={},env={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:n=>{if(n in imports)return imports[n];throw Error(n);},process:{env},Request,Response,URL,Headers,TextDecoder,Buffer,console});return module.exports;}
const policy=load('src/lib/mobile/session-policy.ts');
function harness(o={}){
 const calls={db:0,login:0,verify:0};class NR extends Request{get cookies(){return {get:()=>o.token===false?undefined:{value:'fixture'}};}}
 const json=(b,i={})=>{const r=new Response(JSON.stringify(b),i);r.cookies={get:n=>n==='auth-token'?{value:'fixture'}:undefined,set:(n,v,p)=>r.headers.append('Set-Cookie',n+'='+v+'; Max-Age='+p.maxAge+'; HttpOnly')};return r;};
 const user=o.user===undefined?{id:7,username:'member',email:'member@example.test',walletAddress:null,isActive:true,isApproved:true}:o.user;
 const db={select:()=>({from:()=>({where:()=>({limit:async()=>{calls.db++;return user?[user]:[];}})})})};
 const api=load('src/app/api/mobile/session/route.ts',{'next/server':{NextRequest:NR,NextResponse:{json}},jsonwebtoken:{verify:()=>{calls.verify++;if(o.badToken)throw Error('bad');return o.payload||{userId:7};}},'drizzle-orm':{eq:()=>true},'@/lib/db':{getConnection:async()=>({execute:async()=>[[],[]]}),getDb:async()=>{if(o.dbError)throw Error('down');return db;}},'@/lib/db/schema':{marketplaceUsers:{}},'@/lib/mysqlTruthy':{mysqlTruthy:v=>v===true||v===1},'@/lib/auth-cookie-options':{cookieHostFromRequest:()=> 'example.test',sessionCookieBase:()=>({httpOnly:true,path:'/'})},'@/app/api/marketplace/login/route':{POST:async r=>{calls.login++;calls.body=await r.json();return json({success:true},{status:o.loginStatus||200,headers:{'Set-Cookie':'auth-token=fixture; HttpOnly'}});}},'@/lib/mobile/terms-document':{activeMemberTerms:()=>o.termsDocument===null?null:{version:'test-v1',sha256:'a'.repeat(64),title:'Test agreement',html:'<p>Test only</p>'}},'@/lib/mobile/terms-acceptance':{findTermsReceipt:async()=>{calls.termsRead=(calls.termsRead||0)+1;return o.receipt||null;}},'@/lib/mobile/session-policy':policy,'@/lib/mobile/admin-session':{mobileAdminCookie:'__Host-smart-trust-mobile-admin',checkMobileAdministrator:async()=>o.adminApproved?{ok:true,user:{role:'administrator',username:'verified-admin'}}:{ok:false,status:401},signInMobileAdministrator:async()=>o.adminApproved?{ok:true,user:{role:'administrator',username:'verified-admin'},token:'fixture.admin.signature'}:{ok:false,status:401}}},{SMART_TRUST_MOBILE_ENABLED:'true',JWT_SECRET:'fixture-only',...o.env});
 return {api,calls,req:(method='GET',body,origin='https://example.test')=>new NR('https://example.test/api/mobile/session',{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})};
}
test('identity rejects admin, negative, fractional, malformed and unsafe IDs',()=>{for(const p of [{isAdmin:true,userId:7},{userId:-1},{userId:1.5},{userId:'7abc'},{userId:0},{userId:Number.MAX_SAFE_INTEGER+1}])assert.equal(policy.mobileMemberId(p),null);assert.equal(policy.mobileMemberId({userId:'7'}),7);});
test('disabled feature or missing secret fail before database/login',async()=>{for(const env of [{SMART_TRUST_MOBILE_ENABLED:'false'},{JWT_SECRET:''}]){const h=harness({env});assert.ok((await h.api.GET(h.req())).status>=400);assert.ok((await h.api.POST(h.req('POST',{identifier:'a',password:'b'}))).status>=400);assert.deepEqual(h.calls,{db:0,login:0,verify:0});}});
test('missing invalid or admin cookies cannot load member account',async()=>{for(const o of [{token:false},{badToken:true},{payload:{isAdmin:true,userId:7}}]){const h=harness(o);assert.equal((await h.api.GET(h.req())).status,401);assert.equal(h.calls.db,0);}});
test('approved active account returns selected profile only and no-store',async()=>{const h=harness();const r=await h.api.GET(h.req());assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('vary'),'Cookie');assert.deepEqual(await r.json(),{user:{id:7,username:'member',email:'member@example.test',walletAddress:null}});});
test('deleted inactive or unapproved accounts refused on every read',async()=>{for(const user of [null,{id:7,isActive:false,isApproved:true},{id:7,isActive:true,isApproved:false}]){const h=harness({user});assert.equal((await h.api.GET(h.req())).status,403);}});
test('database outage never becomes a signed-in state',async()=>{const h=harness({dbError:true});assert.equal((await h.api.GET(h.req())).status,503);});
test('cross-origin login and logout refused',async()=>{const h=harness();assert.equal((await h.api.POST(h.req('POST',{identifier:'a',password:'b'},'https://attacker.test'))).status,403);assert.equal((await h.api.DELETE(h.req('DELETE',undefined,'https://attacker.test'))).status,403);assert.equal(h.calls.login,0);});
test('login reuses website implementation and preserves HttpOnly cookie',async()=>{const h=harness();const r=await h.api.POST(h.req('POST',{identifier:' member ',password:'test-password'}));assert.equal(r.status,200);assert.deepEqual(h.calls.body,{identifier:'member',password:'test-password'});assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal(r.headers.get('cache-control'),'no-store');});
test('bad credentials rejected without enumeration details',async()=>{const h=harness();assert.equal((await h.api.POST(h.req('POST',{identifier:7,password:'x'}))).status,400);assert.equal(h.calls.login,0);const bad=harness({loginStatus:404});const r=await bad.api.POST(bad.req('POST',{identifier:'x',password:'y'}));assert.match((await r.json()).error,/Sign-in failed/);});
test('logout expires member cookie without clearing independent admin session',async()=>{const h=harness();const r=await h.api.DELETE(h.req('DELETE'));assert.match(r.headers.get('set-cookie'),/auth-token=; Max-Age=0/);assert.doesNotMatch(r.headers.get('set-cookie'),/admin-token/);});
test('approved members cannot retrieve profile before current terms acceptance',async()=>{
 const h=harness({env:{SMART_TRUST_MOBILE_TERMS_REQUIRED:'true'}});const response=await h.api.GET(h.req());const data=await response.json();
 assert.equal(response.status,200);assert.equal(data.access,'terms_required');assert.equal(data.terms.version,'test-v1');assert.equal(data.user,undefined);
 assert.equal(h.calls.termsRead,1);
 const login=await h.api.POST(h.req('POST',{identifier:'member',password:'fixture'}));assert.deepEqual(await login.json(),{success:true});assert.match(login.headers.get('set-cookie'),/HttpOnly/);
});
test('dated receipt permits profile and unpublished terms fail closed',async()=>{
 const receipt={id:'10',version:'test-v1',sha256:'a'.repeat(64),acceptedAt:'2026-10-30T20:00:00.000000Z'};
 const h=harness({receipt,env:{SMART_TRUST_MOBILE_TERMS_REQUIRED:'true'}});const data=await(await h.api.GET(h.req())).json();assert.equal(data.user.id,7);assert.deepEqual(data.termsAcceptance,receipt);
 const draft=harness({termsDocument:null,env:{SMART_TRUST_MOBILE_TERMS_REQUIRED:'true'}});const pending=await(await draft.api.GET(draft.req())).json();assert.equal(pending.access,'terms_unavailable');assert.equal(pending.user,undefined);assert.equal(draft.calls.termsRead,undefined);
});
test('verified administrator bypasses member terms and receipt storage',async()=>{
 const h=harness({adminApproved:true,termsDocument:null,env:{SMART_TRUST_MOBILE_ADMIN_LOGIN:'true',SMART_TRUST_MOBILE_TERMS_REQUIRED:'true'}});const data=await(await h.api.GET(h.req())).json();assert.equal(data.user.role,'administrator');assert.equal(h.calls.db,0);assert.equal(h.calls.termsRead,undefined);
});
function acceptanceHarness(o={}) {
 const calls=[];class NR extends Request {get cookies(){return {get:()=>({value:'fixture'})};}}
 const document={version:'test-v1',sha256:'a'.repeat(64),title:'Test agreement',html:'<p>Test only</p>'};
 class EligibilityError extends Error {}
 const api=load('src/app/api/mobile/terms/route.ts',{'next/server':{NextRequest:NR,NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),init)}},jsonwebtoken:{verify:()=>o.admin?{isAdmin:true,userId:7}:{userId:7}},'@/lib/db':{getConnection:async()=>({})},'@/lib/mobile/session-policy':policy,'@/lib/mobile/terms-document':{activeMemberTerms:()=>o.draft?null:document},'@/lib/mobile/terms-acceptance':{isTermsAcceptance:(input,doc)=>input&&Object.keys(input).every(k=>['accepted','version','sha256'].includes(k))&&input.accepted===true&&input.version===doc.version&&input.sha256===doc.sha256,recordTermsAcceptance:async(_db,id,doc)=>{calls.push({id,doc});if(o.inactive)throw new EligibilityError();if(o.fail)throw Error('storage');return {id:'1',version:doc.version,sha256:doc.sha256,acceptedAt:'2026-10-30T20:00:00.000000Z'};},TermsEligibilityError:EligibilityError}},{SMART_TRUST_MOBILE_ENABLED:'true',SMART_TRUST_MOBILE_TERMS_REQUIRED:'true',JWT_SECRET:'test-only'});
 return {api,calls,document,request:(body,origin='https://example.test')=>new NR('https://example.test/api/mobile/terms',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)})};
}
test('acceptance endpoint rejects cross-origin, administrator and stale/forged acceptance',async()=>{
 const body={accepted:true,version:'test-v1',sha256:'a'.repeat(64)};const h=acceptanceHarness();
 assert.equal((await h.api.POST(h.request(body,'https://unrelated.example'))).status,403);
 for(const input of [{...body,accepted:false},{...body,memberId:99},{...body,acceptedAt:'2000-01-01'},{...body,version:'old'}])assert.equal((await h.api.POST(h.request(input))).status,409);
 assert.equal(h.calls.length,0);const admin=acceptanceHarness({admin:true});assert.equal((await admin.api.POST(admin.request(body))).status,401);assert.equal(admin.calls.length,0);
});
test('acceptance endpoint binds authenticated member, confirms saved receipt and fails closed',async()=>{
 const body={accepted:true,version:'test-v1',sha256:'a'.repeat(64)};const h=acceptanceHarness();const response=await h.api.POST(h.request(body));assert.equal(response.status,200);assert.equal(h.calls[0].id,7);assert.equal((await response.json()).receipt.acceptedAt,'2026-10-30T20:00:00.000000Z');
 for(const [o,status] of [[{draft:true},503],[{inactive:true},403],[{fail:true},503]]){const blocked=acceptanceHarness(o);assert.equal((await blocked.api.POST(blocked.request(body))).status,status);}
});
test('administrator sign-in needs explicit mode, enabled feature and verified website authority',async()=>{
 const body={identifier:'admin',password:'fixture-password',accountType:'administrator'};
 const disabled=harness();assert.equal((await disabled.api.POST(disabled.req('POST',body))).status,503);assert.equal(disabled.calls.login,0);
 const denied=harness({env:{SMART_TRUST_MOBILE_ADMIN_LOGIN:'true'}});assert.equal((await denied.api.POST(denied.req('POST',body))).status,401);
 const allowed=harness({adminApproved:true,env:{SMART_TRUST_MOBILE_ADMIN_LOGIN:'true'}});const response=await allowed.api.POST(allowed.req('POST',body));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true,user:{role:'administrator',username:'verified-admin'}});
 assert.match(response.headers.get('set-cookie'),/__Host-smart-trust-mobile-admin=fixture.admin.signature/);
 assert.equal(allowed.calls.db,0);assert.equal(allowed.calls.login,0);
});
function browser(o={}){const nodes=new Map(),events={},pending=[];const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',value:'',disabled:false,removeAttribute(name){delete this[name];},replaceChildren(){this.children=[];},append(...children){this.children=(this.children||[]).concat(children);},focus(){},addEventListener:(k,f)=>{events[id+':'+k]=f;}});return nodes.get(id);};const ctx={document:{getElementById:node,createElement:()=>({textContent:"",append(...children){this.children=children;}}),hidden:false,addEventListener:(k,f)=>{events['doc:'+k]=f;}},window:{addEventListener:(k,f)=>{events[k]=f;}},navigator:{},fetch:(url)=>url==='/api/mobile/profile'&&!o.deferProfile?Promise.resolve(new Response(JSON.stringify({profile:{bannerData:null,avatarData:null,selectedAvatar:null,avatarAvailable:true},worlds:[]}))):new Promise(r=>pending.push(r)),AbortController,setTimeout,clearTimeout,location:{reload(){}},console};vm.runInNewContext(fs.readFileSync(path.join(root,'public/mobile/client.js'),'utf8'),ctx);return {node,events,pending};}
const tick=()=>new Promise(r=>setImmediate(r)),profile={id:7,username:'<img onerror=alert(1)>',email:'member@example.test',walletAddress:null};
test('browser uses text and discards stale session responses',async()=>{const b=browser();b.events['retry:click']();b.pending[1](new Response(JSON.stringify({user:profile})));await tick();assert.equal(b.node('username').textContent,'Username: '+profile.username);assert.equal(b.node('account').hidden,false);b.pending[0](new Response(JSON.stringify({error:'expired'}),{status:401}));await tick();assert.equal(b.node('account').hidden,false);});
test('pagehide clears profile and expired sessions offer sign-in',async()=>{const b=browser();b.pending[0](new Response(JSON.stringify({user:profile})));await tick();b.events.pagehide();assert.equal(b.node('account').hidden,true);assert.equal(b.node('email').textContent,'');b.events.pageshow();b.pending[1](new Response(JSON.stringify({error:'expired'}),{status:401}));await tick();assert.equal(b.node('signin').hidden,false);assert.equal(b.node('account').hidden,true);});
test('browser displays verified administrator without inventing a member id',async()=>{const b=browser();b.pending[0](new Response(JSON.stringify({user:{role:'administrator',username:'verified-admin'}})));await tick();assert.equal(b.node('account').hidden,false);assert.equal(b.node('memberId').textContent,'Account type: Administrator');assert.equal(b.node('email').textContent,'Website administrator account');b.events.pagehide();assert.equal(b.node('account').hidden,true);});
test('browser requires an unchecked affirmative acceptance and rereads saved state',async()=>{
 const b=browser();const terms={version:'test-v1',sha256:'a'.repeat(64)};b.pending[0](new Response(JSON.stringify({access:'terms_required',terms})));await tick();
 assert.equal(b.node('account').hidden,true);assert.equal(b.node('termsGate').hidden,false);assert.equal(b.node('termsAccepted').checked,false);assert.equal(b.node('acceptTerms').disabled,true);
 await b.events['termsForm:submit']({preventDefault(){}});assert.equal(b.pending.length,1);
 b.node('termsAccepted').checked=true;b.events['termsAccepted:change']();assert.equal(b.node('acceptTerms').disabled,false);
 const accepting=b.events['termsForm:submit']({preventDefault(){}});assert.equal(b.node('account').hidden,true);
 b.pending[1](new Response(JSON.stringify({accepted:true,receipt:{acceptedAt:'2026-10-30T20:00:00Z'}})));await tick();assert.equal(b.pending.length,3);
 b.pending[2](new Response(JSON.stringify({user:profile,termsAcceptance:{version:'test-v1',acceptedAt:'2026-10-30T20:00:00Z'}})));await accepting;
 assert.equal(b.node('account').hidden,false);assert.match(b.node('termsReceipt').textContent,/accepted \(UTC\)/);
});
test('browser keeps profile blocked after acceptance storage failure',async()=>{
 const b=browser();b.pending[0](new Response(JSON.stringify({access:'terms_required',terms:{version:'test-v1',sha256:'a'.repeat(64)}})));await tick();b.node('termsAccepted').checked=true;
 const accepting=b.events['termsForm:submit']({preventDefault(){}});b.pending[1](new Response(JSON.stringify({error:'Storage unavailable'}),{status:503}));await accepting;assert.equal(b.node('account').hidden,true);assert.equal(b.node('termsGate').hidden,false);
});
test('no device credentials or API cache; manifest stays within mobile',()=>{const js=fs.readFileSync(path.join(root,'public/mobile/client.js'),'utf8');assert.doesNotMatch(js,/localStorage|sessionStorage|passHash|Math.random/);const sw=fs.readFileSync(path.join(root,'public/smart-trust-mobile-sw.js'),'utf8');assert.doesNotMatch(sw,/caches\.|addEventListener\(['"]fetch/);const m=JSON.parse(fs.readFileSync(path.join(root,'public/mobile/manifest.webmanifest'),'utf8'));assert.equal(m.start_url,'/mobile');assert.equal(m.scope,'/mobile');});
test('HTML route is gated no-store and protected against embedding',()=>{const shell=load('src/lib/mobile/shell.ts');const off=load('src/app/mobile/route.ts',{'@/lib/mobile/shell':shell});assert.equal(off.GET().status,404);const on=load('src/app/mobile/route.ts',{'@/lib/mobile/shell':shell},{SMART_TRUST_MOBILE_ENABLED:'true'});const r=on.GET();assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);});

// Route-backed assets need not exist under public/.
test('manifest PNG and Apple icon resolve to a 512px PNG route', async()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'public/mobile/manifest.webmanifest'),'utf8'));
 const shell=load('src/lib/mobile/shell.ts').mobileShell;
 const icon=m.icons.find(i=>i.type==='image/png');
 assert.equal(icon.src,'/mobile/icon.png');assert.equal(icon.sizes,'512x512');
 assert.match(shell,/rel="apple-touch-icon" href="\/mobile\/icon.png"/);
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/app/mobile/icon.png/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,Buffer,Response});
 const response=module.exports.GET();assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
 const bytes=Buffer.from(await response.arrayBuffer());
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(bytes.toString('ascii',12,16),'IHDR');assert.equal(bytes.readUInt32BE(16),512);assert.equal(bytes.readUInt32BE(20),512);
});



test('profile images and Journey are present above workspace links',()=>{
 const html=load('src/lib/mobile/shell.ts').mobileShell;
 assert.ok(html.indexOf('id="profileBanner"')<html.indexOf('id="journeyBtn"'));
 assert.ok(html.indexOf('id="profileAvatar"')<html.indexOf('id="journeyBtn"'));
 assert.match(html,/START YOUR JOURNEY/);assert.match(html,/id="explorer" hidden/);
});
test('member profile loads account images and Journey has a real empty state',async()=>{
 const b=browser();b.pending[0](new Response(JSON.stringify({user:profile})));await tick();
 assert.equal(b.node('profileImageControls').hidden,false);assert.equal(b.node('journeyBtn').hidden,false);
 b.events['journeyBtn:click']();assert.equal(b.node('explorer').hidden,false);assert.match(b.node('worldMessage').textContent,/No saved worlds/);
 b.events['explorerBack:click']();assert.equal(b.node('profileScreen').hidden,false);
});
test('late image response cannot restore another session after sign-out or pagehide',async()=>{
 const b=browser({deferProfile:true});b.pending[0](new Response(JSON.stringify({user:profile})));await tick();
 b.events.pagehide();b.pending[1](new Response(JSON.stringify({profile:{bannerData:'data:image/png;base64,fixture',avatarData:'data:image/png;base64,fixture'},worlds:[]})));await tick();
 assert.equal(b.node('account').hidden,true);assert.equal(b.node('profileBanner').src,undefined);assert.equal(b.node('profileAvatar').src,undefined);assert.equal(b.node('profileImageControls').hidden,true);
});
function profileHarness(options={}) {
 const calls=[];
 const route=load('src/app/api/mobile/profile/route.ts',{
  'next/server':{NextResponse:{json:(data,init)=>new Response(JSON.stringify(data),init)}},
  '@/app/api/mobile/session/route':{GET:async()=>new Response(JSON.stringify(options.session??{user:{id:7,username:'member'}}),{status:options.status??200})},
  '@/lib/mobile/session-policy':policy,'@/lib/db':{getConnection:async()=>({})},
  '@/lib/mobile/profile':{profileImage:(x)=>{if(x!==null&&x!=='test-png')throw Error('invalid');return x;},readMemberProfile:async(_db,id)=>{calls.push(['read',id]);return {bannerData:null,avatarData:null};},readMemberWorlds:async(_db,id)=>{calls.push(['worlds',id]);return [];},saveMemberImage:async(_db,id,field,image)=>{calls.push(['save',id,field,image]);}},
 },{SMART_TRUST_MOBILE_ENABLED:'true'});
 return {route,calls,request:(method='GET',body,origin='https://example.test')=>new Request('https://example.test/api/mobile/profile',{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})};
}
test('profile reads and saves bind the authenticated member and reject forged account fields',async()=>{
 const h=profileHarness();assert.equal((await h.route.GET(h.request())).status,200);assert.deepEqual(h.calls,[['read',7],['worlds',7]]);
 assert.equal((await h.route.PATCH(h.request('PATCH',{bannerData:'test-png'}))).status,200);assert.deepEqual(h.calls[2],['save',7,'bannerData','test-png']);
 for(const body of [{memberId:8,bannerData:null},{avatarData:null,bannerData:null},{avatarData:'javascript:alert(1)'}])assert.equal((await h.route.PATCH(h.request('PATCH',body))).status,400);
 assert.equal((await h.route.PATCH(h.request('PATCH',{bannerData:null},'https://attacker.test'))).status,403);
 assert.equal(h.calls.filter(x=>x[0]==='save').length,1);
});
test('profile and Journey cannot bypass terms, revoked login, or administrator separation',async()=>{
 for(const options of [{session:{access:'terms_required'}},{session:{user:{role:'administrator',username:'admin'}}},{session:{error:'revoked'},status:403},{session:{error:'expired'},status:401}]) {
  const h=profileHarness(options);assert.ok((await h.route.GET(h.request())).status>=400);assert.ok((await h.route.PATCH(h.request('PATCH',{avatarData:null}))).status>=400);assert.equal(h.calls.length,0);
 }
});
test('selected images render, broken images fall back, and account clearing removes image sources',async()=>{
 const b=browser({deferProfile:true});b.pending[0](new Response(JSON.stringify({user:profile})));await tick();
 b.pending[1](new Response(JSON.stringify({profile:{bannerData:'data:image/png;base64,fixture',avatarData:null,selectedAvatar:{thumbnailUrl:'https://troothhurtz.app/avatars/chosen.png'},avatarAvailable:true},worlds:[]})));await tick();
 assert.equal(b.node('profileBanner').src,'data:image/png;base64,fixture');assert.equal(b.node('profileAvatar').src,'https://troothhurtz.app/avatars/chosen.png');
 b.events['profileAvatar:error']();assert.equal(b.node('profileAvatar').hidden,true);assert.equal(b.node('avatarPlaceholder').hidden,false);
 b.events.pagehide();assert.equal(b.node('profileBanner').src,undefined);assert.equal(b.node('journeyBtn').hidden,true);
});
test('Journey lists actual account world names safely without granting entry or ownership',async()=>{
 const b=browser({deferProfile:true});b.pending[0](new Response(JSON.stringify({user:profile})));await tick();
 b.pending[1](new Response(JSON.stringify({profile:{avatarAvailable:true},worlds:[{id:'own-world',name:'<img onerror=alert(1)>',visibility:'private',status:'draft'}]})));await tick();
 b.events['journeyBtn:click']();const card=b.node('worldList').children[0];assert.equal(card.children[0].textContent,'<img onerror=alert(1)>');assert.equal(card.href,undefined);
});
