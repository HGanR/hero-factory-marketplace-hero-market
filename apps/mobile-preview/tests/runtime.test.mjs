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
 const clean={...process.env};for(const name of ['DATABASE_URL','JWT_SECRET','SMART_TRUST_MOBILE_ENABLED','AUTH_COOKIE_DOMAIN'])delete clean[name];
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
