const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../src/lib/db/index.ts'), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS, esModuleInterop:true}}).outputText;
for (const options of ['mysql://fixture', {host:'fixture',ssl:{rejectUnauthorized:true}}]) {
 test('connection forwards '+(typeof options === 'string' ? 'URI' : 'TLS options')+' unchanged and reuses live connection', async()=>{
  const calls=[];let pings=0;const connection={ping:async()=>{pings++;}};
  const module={exports:{}};
  const imports={
   'drizzle-orm/mysql2':{drizzle:c=>c},
   'mysql2/promise':{createConnection:async o=>{calls.push(o);return connection;}},
   '@/lib/db/mysql2-connection-options':{mysql2ConnectionOptionsFromUrl:()=>options},
   '@/lib/db/db-timeout':{withDbTimeout:()=>{}}
  };
  vm.runInNewContext(code,{module,exports:module.exports,process:{env:{DATABASE_URL:'fixture'}},console,require:n=>{if(!(n in imports))throw Error(n);return imports[n];}});
  assert.equal(await module.exports.getConnection(),connection);
  assert.equal(await module.exports.getConnection(),connection);
  assert.equal(calls.length,1);assert.equal(calls[0],options);assert.equal(pings,1);
 });
}
