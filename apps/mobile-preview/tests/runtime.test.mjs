import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function withServer(env, check) {
 const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
 const port=socket.address().port;await new Promise(r=>socket.close(r));
 const clean={...process.env};for(const name of ['DATABASE_URL','JWT_SECRET','SMART_TRUST_MOBILE_ENABLED','AUTH_COOKIE_DOMAIN','SMART_TRUST_MOBILE_SESSION_COOKIE','SMART_TRUST_MOBILE_ADMIN_LOGIN'])delete clean[name];
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:app,env:{...clean,...env},stdio:['ignore','pipe','pipe']});
 const origin=`http://localhost:${port}`;
 try {
  let ready=false;
  for(let i=0;i<100;i++) {try {await fetch(origin);ready=true;break;}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'built Next server starts');await check(origin);
 } finally {child.kill('SIGTERM');await once(child,'exit');}
}
test('built app stays gated by default',()=>withServer({},async base=>{
 for(const url of ['/mobile','/api/mobile/session'])assert.equal((await fetch(base+url)).status,404);
}));
test('built app exposes working assets but fails closed without signing secret',()=>withServer({SMART_TRUST_MOBILE_ENABLED:'true'},async base=>{
 const page=await fetch(base+'/mobile');assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store');const html=await page.text();assert.match(html,/Protected test build/);assert.match(html,/href="https:\/\/troothhurtz.app\/"/);
 for(const url of ['/mobile/client.js','/mobile/theme.css','/mobile/manifest.webmanifest','/mobile/icon.png','/smart-trust-mobile-sw.js','/mobile/terms'])assert.equal((await fetch(base+url)).status,200,url);
 assert.equal((await fetch(base+'/api/mobile/session')).status,503);
 assert.equal((await fetch(base+'/api/marketplace/login',{method:'POST'})).status,404);
 const redirect=await fetch(base+'/app/dashboard',{redirect:'manual'});assert.equal(redirect.headers.get('location'),'https://troothhurtz.app/app/dashboard');
}));
test('real server verifies JWT and origin; unavailable DB cannot appear signed in',()=>withServer({SMART_TRUST_MOBILE_ENABLED:'true',JWT_SECRET:'local-test-only-not-a-deployment-secret'},async base=>{
 assert.equal((await fetch(base+'/api/mobile/session')).status,401);
 const token=jwt.sign({userId:7},'local-test-only-not-a-deployment-secret',{algorithm:'HS256',expiresIn:60});
 const response=await fetch(base+'/api/mobile/session',{headers:{cookie:'auth-token='+token}});
 assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await fetch(base+'/api/mobile/session',{method:'POST',headers:{origin:'https://unrelated.example','content-type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/mobile/session',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{}'})).status,400);
}));

test('dedicated mobile session ignores website/admin cookies and logs out only mobile',()=>withServer({SMART_TRUST_MOBILE_ENABLED:'true',JWT_SECRET:'local-mobile-test-only',SMART_TRUST_MOBILE_SESSION_COOKIE:'__Host-smart-trust-mobile',AUTH_COOKIE_DOMAIN:'.troothhurtz.app'},async base=>{
 const token=jwt.sign({userId:7},'local-mobile-test-only',{algorithm:'HS256',expiresIn:60});
 for(const cookie of ['auth-token='+token,'admin-token='+token]) {
  assert.equal((await fetch(base+'/api/mobile/session',{headers:{cookie}})).status,401);
 }
 const admin=jwt.sign({userId:7,isAdmin:true},'local-mobile-test-only',{algorithm:'HS256',expiresIn:60});
 assert.equal((await fetch(base+'/api/mobile/session',{headers:{cookie:'__Host-smart-trust-mobile='+admin}})).status,401);
 // A valid mobile token reaches the unavailable database; a website cookie cannot replace it.
 assert.equal((await fetch(base+'/api/mobile/session',{headers:{cookie:'auth-token=wrong; __Host-smart-trust-mobile='+token}})).status,503);
 const logout=await fetch(base+'/api/mobile/session',{method:'DELETE',headers:{origin:base}});
 assert.equal(logout.status,200);
 const cookie=logout.headers.get('set-cookie');
 assert.match(cookie,/__Host-smart-trust-mobile=/);assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);
 assert.match(cookie,/SameSite=lax/i);assert.match(cookie,/Path=\//);assert.match(cookie,/Max-Age=0/i);
 assert.doesNotMatch(cookie,/Domain=|(?:^|[,;] ?)auth-token=|admin-token=/i);
}));

test('administrator mode keeps origin checks and clears only private mobile cookies',()=>withServer({SMART_TRUST_MOBILE_ENABLED:'true',JWT_SECRET:'local-admin-mode-test',SMART_TRUST_MOBILE_SESSION_COOKIE:'__Host-smart-trust-mobile',SMART_TRUST_MOBILE_ADMIN_LOGIN:'true'},async base=>{
 assert.equal((await fetch(base+'/api/mobile/session',{headers:{cookie:'__Host-smart-trust-mobile-admin=invalid'}})).status,401);
 const headers={'content-type':'application/json',origin:'https://unrelated.example'};
 assert.equal((await fetch(base+'/api/mobile/session',{method:'POST',headers,body:JSON.stringify({identifier:'admin',password:'fixture',accountType:'administrator'})})).status,403);
 assert.equal((await fetch(base+'/api/mobile/session',{method:'POST',headers:{...headers,origin:base},body:JSON.stringify({identifier:'admin',password:'fixture',accountType:'owner'})})).status,400);
 const logout=await fetch(base+'/api/mobile/session',{method:'DELETE',headers:{origin:base}});
 assert.equal(logout.status,200);
 const cookies=logout.headers.getSetCookie();
 assert.equal(cookies.length,2);
 assert.ok(cookies.some(c=>c.startsWith('__Host-smart-trust-mobile=')));
 assert.ok(cookies.some(c=>c.startsWith('__Host-smart-trust-mobile-admin=')));
 for(const cookie of cookies){assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/Max-Age=0/i);assert.doesNotMatch(cookie,/Domain=/i);}
}));

