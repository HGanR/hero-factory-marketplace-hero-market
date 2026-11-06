import test from 'node:test';
import assert from 'node:assert/strict';
import {decideStadium,validPass} from '../../src/lib/stadium/admission.ts';
const event={webEnabled:true,isActive:true,accessType:'invite_only',createdByUserId:7};
const now=Date.now(),pass={status:'pending',expiresAt:new Date(now+1000),inviteeUserId:8,inviteeEmail:null,inviteeWallet:null};
test('a direct link cannot admit another account to a restricted room',()=>{
 for(const accessType of ['private','invite_only']){
 const n={...event,accessType};
 assert.equal(decideStadium(n,8,false).status,403);assert.equal(decideStadium(n,null,true).status,401);
 assert.deepEqual(decideStadium(n,8,true),{status:200,host:false});
 assert.deepEqual(decideStadium(n,7,false),{status:200,host:true});
 }});
test('a public visitor is audience only; closing disables even host entry',()=>{
 assert.deepEqual(decideStadium({...event,accessType:'public'},null,false),{status:200,host:false});
 for(const change of [{isActive:false},{webEnabled:false}])assert.equal(decideStadium({...event,...change},7,true).status,403);
});
test('reject expired, revoked, and wrong-recipient credentials',()=>{
 assert.equal(validPass(pass,8,now),true);
 for(const [p,user] of [[pass,9],[pass,null],[{...pass,status:'revoked'},8],[{...pass,expiresAt:new Date(now)},8],[undefined,8]]) assert.equal(validPass(p,user,now),false);
});
