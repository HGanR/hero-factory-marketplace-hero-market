import {test} from 'node:test';
import assert from 'node:assert/strict';
import {amountUnits,address,paymentId,validateReceipt,TOKEN,TREASURY,walletMessage} from '../../src/lib/world-checkout/policy.ts';
const wallet='0x1111111111111111111111111111111111111111';
const o={kind:'world-troo-v1',userId:1,assetId:'asset',wallet,amount:'1000000000000000000',price:'1',issuedBlock:'100',deadline:500,nonce:'n',iat:1};
function check(change={}){const p={receipt:{status:'success',blockNumber:101n},transaction:{from:wallet,to:TOKEN},block:{timestamp:200n},latest:132n,transfers:[{from:wallet,to:TREASURY,value:10n**18n}],...change};return validateReceipt(o,p.receipt,p.transaction,p.block,p.latest,p.transfers);}
test('prices use exact base units and reject invalid/negative/scientific values',()=>{assert.equal(amountUnits('1.000000000000000001'),'1000000000000000001');for(const v of [-1,'NaN','1e5','0.0000000000000000001'])assert.throws(()=>amountUnits(v));});
test('addresses are canonical and zero is rejected',()=>{assert.equal(address(TREASURY.toUpperCase().replace('0X','0x')),TREASURY);assert.throws(()=>address('0x'+'0'.repeat(40)));});
test('one transaction has one global ownership id independent of case',()=>{const h='0x'+'ab'.repeat(32);assert.equal(paymentId(h),paymentId(h.toUpperCase().replace('0X','0x')));assert.equal(paymentId(h).length,36);assert.throws(()=>paymentId('fake'));});
test('confirmed exact transfer is accepted',()=>check());
for(const [name,change] of Object.entries({reverted:{receipt:{status:'reverted',blockNumber:101n}},old:{receipt:{status:'success',blockNumber:100n}},late:{block:{timestamp:501n}},pending:{latest:131n},sender:{transaction:{from:TREASURY,to:TOKEN}},token:{transaction:{from:wallet,to:TREASURY}},recipient:{transfers:[{from:wallet,to:wallet,value:10n**18n}]},amount:{transfers:[{from:wallet,to:TREASURY,value:1n}]},missing:{transfers:[]},multiple:{transfers:[{from:wallet,to:TREASURY,value:10n**18n},{from:wallet,to:TREASURY,value:10n**18n}]}}))test('reject '+name,()=>assert.throws(()=>check(change)));
test('signature message binds member asset price network token recipient and nonce',()=>{const message=walletMessage(o);for(const s of ['Member: 1','Asset: asset','Polygon (137)',TOKEN,TREASURY,'Price: 1 TROO','Order: n'])assert.ok(message.includes(s));});
