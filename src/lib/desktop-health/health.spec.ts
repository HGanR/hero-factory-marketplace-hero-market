import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { healthMemberId } from './member';
import { boundedJson,sameOrigin,healthBridge } from './bridge';

test('member identity comes from a valid member session and current approval, never a submitted account id',async()=>{
  const prior=process.env.JWT_SECRET;process.env.JWT_SECRET='test-only-member-signing-secret';
  try{
    let calls=0;const lookup=async(id:number)=>{calls++;return {id,isActive:1,isApproved:1};};
    const request=(payload:object,key=process.env.JWT_SECRET!)=>new NextRequest('https://member.test/api/desktop-health/report',{headers:{cookie:'auth-token='+jwt.sign(payload,key,{expiresIn:'1h'})}});
    assert.equal(await healthMemberId(request({userId:12}),lookup),12);
    assert.equal(await healthMemberId(request({userId:12,isAdmin:true}),lookup),null);
    assert.equal(await healthMemberId(request({userId:'12junk'}),lookup),null);
    assert.equal(await healthMemberId(request({userId:12},'wrong-secret'),lookup),null);
    assert.equal(calls,1);
    assert.equal(await healthMemberId(request({userId:12}),async()=>({id:12,isActive:1,isApproved:0})),null);
    assert.equal(await healthMemberId(request({userId:12}),async()=>({id:12,isActive:0,isApproved:1})),null);
    delete process.env.JWT_SECRET;assert.equal(await healthMemberId(request({userId:12},'test-only-member-signing-secret'),lookup),null);
  }finally{if(prior===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=prior;}
});
test('health writes require same origin and enforce streamed byte limits',async()=>{
  assert.equal(sameOrigin(new Request('https://member.test/api',{headers:{origin:'https://other.test'}})),false);
  assert.equal(sameOrigin(new Request('https://member.test/api',{headers:{origin:'https://member.test'}})),true);
  await assert.rejects(()=>boundedJson(new Request('https://member.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:'a'.repeat(17000)})})));
  assert.deepEqual(await boundedJson(new Request('https://member.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})),{});
});
test('server bridge signs the authenticated identity and does not forward member cookies',async()=>{
  const priorFetch=globalThis.fetch,secret=process.env.SMART_TRUST_HEALTH_BRIDGE_SECRET,url=process.env.SMART_TRUST_HEALTH_SERVICE_URL;
  process.env.SMART_TRUST_HEALTH_BRIDGE_SECRET='test-only-bridge-secret-00000000000000000';process.env.SMART_TRUST_HEALTH_SERVICE_URL='https://release.test/internal/desktop-health';
  globalThis.fetch=async(_input,init)=>{
    const envelope=JSON.parse(String(init?.body));assert.equal(envelope.actor.subject,'marketplace:12');assert.equal(envelope.operation,'report');
    const canonical=(value:unknown):string=>{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';const r=value as Record<string,unknown>;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';};
    const signature=createHmac('sha256',process.env.SMART_TRUST_HEALTH_BRIDGE_SECRET!).update('desktop-health-bridge-v1\n'+canonical(envelope)).digest('hex');
    assert.equal(new Headers(init?.headers).get('x-health-signature'),signature);assert.equal(new Headers(init?.headers).has('cookie'),false);assert.equal(init?.redirect,'error');
    return Response.json({ok:true,incidentId:'receipt'});
  };
  try{assert.equal((await healthBridge('member',12,'report',{})).status,200);}finally{globalThis.fetch=priorFetch;if(secret===undefined)delete process.env.SMART_TRUST_HEALTH_BRIDGE_SECRET;else process.env.SMART_TRUST_HEALTH_BRIDGE_SECRET=secret;if(url===undefined)delete process.env.SMART_TRUST_HEALTH_SERVICE_URL;else process.env.SMART_TRUST_HEALTH_SERVICE_URL=url;}
});
