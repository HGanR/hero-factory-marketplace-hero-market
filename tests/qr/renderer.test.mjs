import assert from 'node:assert/strict';
import { test,after } from 'node:test';
import { build } from 'esbuild';
import { mkdtempSync,rmSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

const root=process.cwd(),dir=mkdtempSync(join(root,'.qr-render-test-'));
await build({entryPoints:['src/lib/executive-agent/qr-artifact-renderer.ts'],outfile:join(dir,'renderer.mjs'),bundle:true,platform:'node',format:'esm',packages:'external'});
const m=await import(pathToFileURL(join(dir,'renderer.mjs')));
after(()=>rmSync(dir,{recursive:true,force:true}));
const base={clientId:randomUUID(),workspaceId:randomUUID(),url:'https://example.invalid/client?x=1&next=%2Fwelcome#contact'};
for(const ecc of ['L','M','Q','H'])test('stored PNG/SVG independently decode exactly at ECC '+ecc,async()=>{
  const {record,receipt}=await m.renderQrArtifact({...base,ecc},randomUUID(),randomUUID());
  const saved=m.readQrArtifact(record);
  for(const format of ['png','svg']){
    assert.equal(await m.decodeQrFile(saved.files[format],format,base.url),true);
    assert.equal(m.qrHash(saved.files[format]),receipt[format].sha256);
    assert.equal(saved.files[format].length,receipt[format].bytes);
  }
  assert.equal(receipt.targetFetched,false);assert.equal(receipt.decode.decodedUrl,base.url);
});
test('unique mode records generated qrid and verifies both saved files with that exact URL',async()=>{
  const {record,receipt}=await m.renderQrArtifact({...base,uniqueMode:true},randomUUID(),randomUUID());
  assert.match(receipt.token,/^[a-f0-9-]{36}$/);assert.equal(new URL(receipt.url).searchParams.get('qrid'),receipt.token);
  const {files}=m.readQrArtifact(record);
  for(const kind of ['png','svg'])await m.decodeQrFile(files[kind],kind,receipt.url);
});
test('URLs and unsupported styles fail closed, without silent restyling',async()=>{
  for(const url of ['javascript:alert(1)','data:text/html,x','//example.invalid','example.invalid','https://u:secret@example.invalid','https://example.invalid/a b','https://example.invalid/\npath','https://example.invalid/'+ 'x'.repeat(2048)])
    await assert.rejects(()=>m.renderQrArtifact({...base,url},randomUUID(),randomUUID()));
  for(const extra of [{moduleShape:'dots'},{moduleShape:'rounded'},{moduleShape:'squircle'},{foreground:'#ff0000'},{background:'#000000'},{quietZone:0},{gradient:true}])
    await assert.rejects(()=>m.renderQrArtifact({...base,...extra},randomUUID(),randomUUID()));
});
test('rendering neither fetches nor opens an HTTP request to the target',async()=>{
  const old=[globalThis.fetch,http.request,https.request];let calls=0;
  globalThis.fetch=http.request=https.request=()=>{calls++;throw Error('No target fetch permitted');};
  try{await m.renderQrArtifact({...base,url:'http://127.0.0.1:8080/private'},randomUUID(),randomUUID());assert.equal(calls,0);}
  finally{[globalThis.fetch,http.request,https.request]=old;}
});
test('decoder refuses a different target and stored corruption cannot be read as verified',async()=>{
  const {record}=await m.renderQrArtifact(base,randomUUID(),randomUUID());
  const {files}=m.readQrArtifact(record);await assert.rejects(()=>m.decodeQrFile(files.png,'png','https://other.invalid'));
  const data=JSON.parse(record);data.receipt.png.sha256='0'.repeat(64);assert.throws(()=>m.readQrArtifact(JSON.stringify(data)),/integrity/);
  data.packed='broken';assert.throws(()=>m.readQrArtifact(JSON.stringify(data)));
  assert.throws(()=>m.readQrArtifact('x'.repeat(60001)),/TEXT/);
});
test('Unicode path is encoded exactly and dense undersized output is rejected',async()=>{
  const url='https://example.invalid/日本語/é?message=hello%20world';
  const {receipt}=await m.renderQrArtifact({...base,url},randomUUID(),randomUUID());assert.equal(receipt.url,url);
  await assert.rejects(()=>m.renderQrArtifact({...base,url:'https://example.invalid/'+'x'.repeat(500),ecc:'H',sizePx:128},randomUUID(),randomUUID()),/dense|budget/);
});
