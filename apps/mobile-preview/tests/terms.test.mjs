import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {activeMemberTerms, validatePublishedTerms} from '../shared/src/lib/mobile/terms-document.ts';
import {isTermsAcceptance, findTermsReceipt, recordTermsAcceptance, TermsEligibilityError} from '../shared/src/lib/mobile/terms-acceptance.ts';

const candidate={version:'fixture-v1',title:'Nonbinding test fixture',published:true,html:'<p>Software test document only.</p>'};
const terms=validatePublishedTerms(candidate);
test('draft terms and unresolved placeholders cannot become an accepted agreement',()=>{
 assert.equal(activeMemberTerms(),null);
 assert.equal(validatePublishedTerms({...candidate,published:false}),null);
 assert.equal(validatePublishedTerms({...candidate,html:'<p>[INSERT DATE]</p>'}),null);
 assert.equal(validatePublishedTerms({...candidate,version:'../unsafe'}),null);
 assert.equal(terms.sha256,createHash('sha256').update(candidate.html).digest('hex'));
 assert.notEqual(validatePublishedTerms({...candidate,html:'Changed test copy'}).sha256,terms.sha256);
});
test('acceptance must affirm the exact version and content and cannot supply member/date',()=>{
 const accepted={accepted:true,version:terms.version,sha256:terms.sha256};
 assert.equal(isTermsAcceptance(accepted,terms),true);
 for(const input of [{...accepted,accepted:false},{...accepted,version:'old'},{...accepted,sha256:'0'.repeat(64)},{...accepted,memberId:99},{...accepted,acceptedAt:'2020-01-01'},null,[]])assert.equal(isTermsAcceptance(input,terms),false);
});
test('receipt statements bind the signed-in member and use first database-generated UTC time',async()=>{
 const calls=[];const receipt={id:'19',version:terms.version,sha256:terms.sha256,acceptedAt:'2026-10-30T20:00:00.000000Z'};
 const db={execute:async(sql,params)=>{calls.push({sql,params});return sql.trimStart().startsWith('SELECT')?[[receipt],[]]:[{affectedRows:1},[]];}};
 assert.deepEqual(await recordTermsAcceptance(db,7,terms),receipt);
 assert.deepEqual(await recordTermsAcceptance(db,7,terms),receipt);
 const inserts=calls.filter(c=>c.sql.includes('INSERT INTO mobile_terms_acceptances'));
 assert.equal(inserts.length,2);
 for(const call of inserts){assert.match(call.sql,/UTC_TIMESTAMP\(3\)/);assert.match(call.sql,/ON DUPLICATE KEY UPDATE member_id/);assert.doesNotMatch(call.sql,/UPDATE.*accepted_at/s);assert.deepEqual(call.params,[terms.version,terms.sha256,7]);}
 for(const call of calls.filter(c=>c.sql.trimStart().startsWith('SELECT')))assert.deepEqual(call.params,[7,terms.version,terms.sha256]);
});
test('missing/ineligible acceptance and storage failure never manufacture a receipt',async()=>{
 const empty={execute:async()=>[[],[]]};assert.equal(await findTermsReceipt(empty,7,terms),null);
 await assert.rejects(recordTermsAcceptance(empty,7,terms),TermsEligibilityError);
 await assert.rejects(recordTermsAcceptance({execute:async()=>{throw Error('unavailable');}},7,terms),/unavailable/);
});

test('real MySQL/TiDB round trip preserves first receipt and excludes inactive members', {skip:!process.env.TEST_MOBILE_TERMS_DATABASE_URL}, async()=>{
 const mysql=(await import('mysql2/promise')).default;
 const {readFile}=await import('node:fs/promises');
 const {mysql2ConnectionOptionsFromUrl}=await import('../shared/src/lib/db/mysql2-connection-options.ts');
 const raw=process.env.TEST_MOBILE_TERMS_DATABASE_URL;
 const schema=new URL(raw).pathname.slice(1);
 assert.match(schema,/^mobile_terms_test_[a-z0-9_]+$/,'requires a dedicated test-only schema');
 assert.notEqual(raw,process.env.DATABASE_URL,'must never use the live account source');
 const db=await mysql.createConnection(mysql2ConnectionOptionsFromUrl(raw));let created=false;
 try {
  const [tables]=await db.query('SHOW TABLES');assert.equal(tables.length,0,'test schema must be empty; existing data is preserved');
  await db.query('CREATE TABLE marketplace_users (id INT PRIMARY KEY, isActive BOOLEAN NOT NULL, isApproved BOOLEAN NOT NULL, passwordHash VARCHAR(255))');created=true;
  const sql=await readFile(new URL('../../../drizzle/manual/mobile_terms_acceptances_20261030.sql',import.meta.url),'utf8');
  // mysql2 disables multi-statements; execute the two additive CREATEs separately.
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.query(statement);
  await db.execute('INSERT INTO marketplace_users VALUES (7,1,1,?),(8,0,1,?)',['fixture-only','fixture-only']);
  const first=await recordTermsAcceptance(db,7,terms);const retry=await recordTermsAcceptance(db,7,terms);assert.deepEqual(retry,first);
  await assert.rejects(recordTermsAcceptance(db,8,terms),TermsEligibilityError);
  const [rows]=await db.query('SELECT COUNT(*) AS n FROM mobile_terms_acceptances');assert.equal(rows[0].n,1);
 }finally {if(created){await db.query('DROP TABLE IF EXISTS mobile_terms_acceptances');await db.query('DROP TABLE IF EXISTS mobile_terms_documents');await db.query('DROP TABLE marketplace_users');}await db.end();}
});
