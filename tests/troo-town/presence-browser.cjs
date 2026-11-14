/** Two browsers, real loopback LiveKit and disposable MySQL. Never uses deployed credentials. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const deps=process.env.TOWN_TEST_DEPS,esbuild=require(deps+'/esbuild'),mysql=require(deps+'/mysql2/promise'),{chromium}=require(deps+'/playwright'),sdk=require(deps+'/livekit-server-sdk');
const root=path.resolve(__dirname,'../..'),out=fs.mkdtempSync(os.tmpdir()+'/presence-browser-'),art=path.resolve('presence-artifacts');fs.mkdirSync(art,{recursive:true});
process.env.JWT_SECRET='loopback-presence-test-secret-not-for-deployment';process.env.NODE_ENV='production';process.env.VERCEL_ENV='preview';process.env.VERCEL_GIT_COMMIT_REF='isolated-rtc-fixture';process.env.LIVEKIT_URL='ws://127.0.0.1:7880';process.env.LIVEKIT_API_KEY='devkey';process.env.LIVEKIT_API_SECRET='secret';
const service=new sdk.RoomServiceClient('http://127.0.0.1:7880','devkey','secret');
const event={id:'show',title:'Loopback show',enabled:true,paid:false,capacity:30,admissionOpensAt:new Date(Date.now()-60000).toISOString(),startsAt:new Date(Date.now()-30000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),chainId:137,contractAddress:'0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a',tokenId:'0'};
global.__presencePublished={layout:{buildings:{'stadium-elyseum':{position:[0,0,0],scale:.4,rotationY:0}},stadium:{events:[event]}}};
function jwt(userId,admin){const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),h=b({alg:'HS256',typ:'JWT'}),p=b({userId,isAdmin:admin,exp:Math.floor(Date.now()/1000)+3600});return h+'.'+p+'.'+crypto.createHmac('sha256',process.env.JWT_SECRET).update(h+'.'+p).digest('base64url')}
let pool,server,browser;const errors=[];
(async()=>{
 const url=new URL(process.env.TOWN_SQL_URL);if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/town_layout_test')throw Error('Disposable loopback database required');
 pool=mysql.createPool({host:url.hostname,port:Number(url.port||3306),user:url.username,password:url.password,database:'town_layout_test',connectionLimit:8});global.__presenceDB=pool;
 for(const sql of fs.readFileSync(root+'/sql/troo-avatar-presence.sql','utf8').replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean))await pool.query(sql);
 for(let i=0;i<40;i++){try{await service.listRooms();break}catch(e){if(i===39)throw e;await new Promise(r=>setTimeout(r,500));}}
 await esbuild.build({stdin:{contents:`export {GET,POST} from './src/app/api/troo-world/presence/route';export {POST as admission} from './src/app/api/troo-world/stadium/admission/route';`,resolveDir:root},outfile:out+'/api.cjs',bundle:true,platform:'node',format:'cjs',nodePaths:[deps],external:['jose','livekit-server-sdk','viem','viem/chains'],plugins:[{name:'ports',setup(b){b.onResolve({filter:/^(@\/lib\/db|next\/server|.*green-terrain-store)$/},a=>({path:a.path,namespace:'port'}));b.onLoad({filter:/.*/,namespace:'port'},a=>({loader:'ts',contents:a.path==='@/lib/db'?`export const getConnection=async()=>globalThis.__presenceDB;`:a.path==='next/server'?`export const NextResponse={json:(body,o={})=>new Response(JSON.stringify(body),{status:o.status||200,headers:o.headers})};`:`export const loadGreenLayout=async()=>globalThis.__presencePublished;`}));b.onResolve({filter:/^@\//},a=>({path:root+'/src/'+a.path.slice(2)+'.ts'}));}}]});
 const api=require(out+'/api.cjs');
 await esbuild.build({entryPoints:[root+'/tests/troo-town/presence-browser-entry.tsx'],outfile:out+'/client.js',bundle:true,platform:'browser',jsx:'automatic',nodePaths:[deps],define:{'process.env.NODE_ENV':'"production"'},tsconfigRaw:{compilerOptions:{baseUrl:root,paths:{'@/*':['src/*']}}}});
 server=http.createServer(async(req,res)=>{try{
  const route=new URL(req.url,'http://127.0.0.1').pathname;
  if(route==='/api/troo-world/presence'||route==='/fixture-event'){
   const chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks).toString(),cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')));
   const request={url:origin+route,headers:new Headers(req.headers),cookies:{get:n=>cookies[n]?{value:cookies[n]}:undefined},text:async()=>raw};
   const response=await(route==='/fixture-event'?api.admission(request):req.method==='GET'?api.GET(request):api.POST(request));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  if(route==='/client.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(out+'/client.js'));return;}
  if(route==='/models/avatars/jarvon-holographic-v1.glb'){res.setHeader('Content-Type','model/gltf-binary');res.end(fs.readFileSync(root+'/public'+route));return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>body{margin:0}button{padding:10px}canvas{display:block}</style><div id="root"></div><script src="/client.js"></script>');
 }catch(e){console.error(e);res.writeHead(500);res.end('fixture failure')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const studio=await browser.newPage({viewport:{width:1100,height:1100}});await studio.goto(origin+'/?studio');await studio.waitForFunction(()=>!!document.querySelector('canvas'));await studio.waitForTimeout(4000);await studio.screenshot({path:art+'/jarvon-standing.png'});await studio.getByRole('button',{name:'Walking',exact:true}).click();await studio.waitForTimeout(600);await studio.screenshot({path:art+'/jarvon-walking.png'});await studio.getByRole('button',{name:'Seated',exact:true}).click();await studio.waitForTimeout(600);await studio.screenshot({path:art+'/jarvon-seated.png'});await studio.close();
 const contexts=await Promise.all([1,2].map(async id=>{const c=await browser.newContext({viewport:{width:1200,height:800},permissions:['microphone']});await c.addCookies([{name:id===1?'admin-token':'auth-token',value:jwt(id,id===1),url:origin}]);return c}));const pages=await Promise.all(contexts.map(c=>c.newPage())),[host,guest]=pages;
 for(const p of pages){p.on('pageerror',e=>errors.push(e.message));await p.goto(origin);await p.waitForFunction(()=>window.__presenceTest?.profile?.signedIn);}
 await host.getByRole('button',{name:'Assign Jarvon to my account'}).click();await host.waitForFunction(()=>window.__presenceTest.profile.avatar==='jarvon');
 for(const p of pages){await p.getByRole('button',{name:'Join nearby chat',exact:true}).click();await p.waitForFunction(()=>window.__presenceTest.connected);assert.equal(await p.evaluate(()=>window.__presenceTest.room.localParticipant.audioTrackPublications.size),0);}
 await guest.getByRole('button',{name:'Enable microphone',exact:true}).click();await guest.waitForFunction(()=>window.__presenceTest.mic);
 await host.waitForFunction(()=>[...window.__presenceTest.room.remoteParticipants.values()].some(p=>[...p.audioTrackPublications.values()].some(t=>t.isSubscribed&&t.track)));
 assert.equal(await host.evaluate(()=>window.__presenceTest.peers.some(p=>p.avatar==='member')),true);
 // Audio actually arrives over RTP, rather than merely finding a published track.
 await host.waitForFunction(async()=>{for(const p of window.__presenceTest.room.remoteParticipants.values())for(const t of p.audioTrackPublications.values())if(t.track){const stats=await t.track.getRTCStatsReport();if(stats&&[...stats.values()].some(s=>s.type==='inbound-rtp'&&s.bytesReceived>0))return true;}return false;});
 const original=await service.getParticipant('troo-presence-preview-'+crypto.createHash('sha256').update('isolated-rtc-fixture').digest('hex').slice(0,24),await guest.evaluate(()=>window.__presenceTest.identity.identity));
 await guest.evaluate(()=>window.__presenceTest.room.localParticipant.setMetadata(JSON.stringify({v:1,avatar:'jarvon',role:'host'})).catch(()=>{}));
 await new Promise(r=>setTimeout(r,300));const protectedPeer=await service.getParticipant(original.room||'troo-presence-preview-'+crypto.createHash('sha256').update('isolated-rtc-fixture').digest('hex').slice(0,24),original.identity);assert.equal(protectedPeer.metadata,original.metadata);
 await guest.getByRole('button',{name:'Stand far away'}).click();await host.waitForFunction(()=>[...window.__presenceTest.room.remoteParticipants.values()].every(p=>[...p.audioTrackPublications.values()].every(t=>!t.isSubscribed)));
 await guest.getByRole('button',{name:'Stand nearby'}).click();await host.waitForFunction(()=>[...window.__presenceTest.room.remoteParticipants.values()].some(p=>[...p.audioTrackPublications.values()].some(t=>t.isSubscribed)));
 await guest.screenshot({path:art+'/jarvon-remote.png'});
 await host.getByRole('button',{name:'Toggle first person'}).click();await host.waitForFunction(()=>!window.__presenceTest.connected);await host.getByRole('button',{name:'Toggle first person'}).click();
 await host.getByRole('button',{name:'Host test event'}).click();await host.waitForFunction(()=>window.__presenceTest.identity?.role==='host');
 await guest.getByRole('button',{name:'Attend test event'}).click();await guest.waitForFunction(()=>window.__presenceTest.identity?.role==='attendee');
 assert.equal(await guest.evaluate(()=>window.__presenceTest.identity.pose.mode),'seated');assert.equal(await host.evaluate(()=>window.__presenceTest.identity.avatar),'jarvon');
 for(const p of pages)assert.equal(await p.evaluate(()=>window.__presenceTest.room.localParticipant.audioTrackPublications.size),0);
 await host.getByRole('button',{name:'Enable microphone',exact:true}).click();await guest.waitForFunction(()=>[...window.__presenceTest.room.remoteParticipants.values()].some(p=>[...p.audioTrackPublications.values()].some(t=>t.isSubscribed)));
 await guest.screenshot({path:art+'/seated-facing-host.png'});await host.screenshot({path:art+'/first-person-host.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync(art+'/acceptance.json',JSON.stringify({exclusiveAvatar:true,mutedOnEntry:true,realRtpReceived:true,nearFarSubscriptions:true,metadataProtected:true,seatedFacingStage:true,hostBroadcast:true,errors},null,2));console.log('Two-browser real LiveKit acceptance passed: muted join, RTP audio, near/far subscriptions, avatar owner, metadata protection, event seat and host audio.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();await new Promise(r=>server?server.close(r):r());await pool?.end()});
