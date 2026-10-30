import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {signInMobileAdministrator, checkMobileAdministrator} from '../shared/src/lib/mobile/admin-session.ts';

const token = 'fixture.admin.signature';
async function fixture(options, run) {
 const calls=[];
 const server=http.createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  calls.push({path:req.url,body,headers:req.headers});
  if(req.url==='/api/admin/login-edge') {
   res.statusCode=options.loginStatus??200;
   if(options.redirect)res.setHeader('Location','https://unrelated.example/');
   if(options.cookie!==false)res.setHeader('Set-Cookie',['admin-token='+token+'; HttpOnly; Secure; Path=/','auth-token=must-not-be-forwarded; HttpOnly']);
   res.end(JSON.stringify({success:true,user:{username:'untrusted-login-body'}}));
  } else {
   res.statusCode=options.checkStatus??200;
   res.end(options.large?'x'.repeat(9000):JSON.stringify(options.profile??{isAdmin:true,username:'verified-admin'}));
  }
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const send=(url,init)=>{
  assert.equal(new URL(url).origin,'https://troothhurtz.app');
  assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
  return fetch('http://127.0.0.1:'+server.address().port+new URL(url).pathname,init);
 };
 try {await run(send,calls);} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('admin login requires canonical session verification and forwards only the admin cookie',()=>fixture({},async(send,calls)=>{
 const result=await signInMobileAdministrator('admin','fixture-password',send);
 assert.deepEqual(result,{ok:true,user:{role:'administrator',username:'verified-admin'},token});
 assert.deepEqual(JSON.parse(calls[0].body),{username:'admin',password:'fixture-password'});
 assert.equal(calls[0].headers.cookie,undefined);assert.equal(calls[0].headers.origin,'https://troothhurtz.app');
 assert.equal(calls[1].headers.cookie,'admin-token='+token);
 assert.ok(!JSON.stringify(calls[1]).includes('fixture-password'));
}));
test('wrong credentials do not mint an admin session or call the verifier',()=>fixture({loginStatus:401},async(send,calls)=>{
 assert.deepEqual(await signInMobileAdministrator('admin','bad',send),{ok:false,status:401});assert.equal(calls.length,1);
}));
test('success body without an issued cookie is insufficient',()=>fixture({cookie:false},async(send,calls)=>{
 assert.deepEqual(await signInMobileAdministrator('admin','fixture-password',send),{ok:false,status:503});assert.equal(calls.length,1);
}));
test('expired or revoked administrator cookie is rejected by the website authority',()=>fixture({checkStatus:401},async(send)=>{
 assert.deepEqual(await signInMobileAdministrator('admin','fixture-password',send),{ok:false,status:401});
 assert.deepEqual(await checkMobileAdministrator(token,send),{ok:false,status:401});
}));
test('member identity cannot be upgraded into an administrator',()=>fixture({profile:{isAdmin:false,username:'member'}},async(send)=>{
 assert.deepEqual(await signInMobileAdministrator('admin','fixture-password',send),{ok:false,status:401});
}));
test('redirects cannot forward credentials to another host',()=>fixture({loginStatus:302,redirect:true},async(send,calls)=>{
 assert.deepEqual(await signInMobileAdministrator('admin','fixture-password',send),{ok:false,status:503});assert.equal(calls.length,1);
}));
test('oversized or unavailable authority responses never become administrator profiles',async()=>{
 await fixture({large:true},async(send)=>assert.deepEqual(await checkMobileAdministrator(token,send),{ok:false,status:503}));
 await fixture({checkStatus:503},async(send)=>assert.deepEqual(await checkMobileAdministrator(token,send),{ok:false,status:503}));
 let called=false;
 assert.deepEqual(await checkMobileAdministrator('injected; cookie=value',async()=>{called=true;}),{ok:false,status:401});
 assert.equal(called,false);
});
