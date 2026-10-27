import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root=path.resolve(app,'../..');
execFileSync(process.execPath,['scripts/prepare-source.mjs'],{cwd:app});
test('every packaged source and asset matches the website bytes',async()=>{
 const m=JSON.parse(await readFile(path.join(app,'source-manifest.json'),'utf8'));
 for(const [file,hash] of Object.entries(m.files)){
  const original=await readFile(path.join(root,file));
  const copied=await readFile(path.join(app,file.startsWith('src/')?'shared/'+file:file));
  assert.deepEqual(copied,original,file);
  assert.equal(createHash('sha256').update(copied).digest('hex'),hash,file);
 }
 for(const required of ['src/app/api/marketplace/login/route.ts','src/lib/auth.ts','src/lib/db/index.ts','src/lib/db/schema.ts','public/smart-trust-mobile-sw.js']) assert.ok(m.files[required],required);
});
test('only the gated mobile API is exposed; shared website login remains an internal dependency',async()=>{
 const routes=await readdir(path.join(app,'app'),{recursive:true});
 assert.deepEqual(routes.filter(p=>p.endsWith('route.ts')).sort(),['api/mobile/session/route.ts','mobile/icon.png/route.ts','mobile/route.ts','mobile/terms/route.ts','route.ts']);
 assert.match(await readFile(path.join(app,'app/api/mobile/session/route.ts'),'utf8'), /@\/app\/api\/mobile\/session\/route/);
});
test('production target is refused before build',()=>{
 assert.throws(()=>execFileSync(process.execPath,['--input-type=module','-e',"import('./next.config.mjs')"],{cwd:app,env:{...process.env,VERCEL_ENV:'production'},stdio:'pipe'}),/protected Preview deployments only/);
});
