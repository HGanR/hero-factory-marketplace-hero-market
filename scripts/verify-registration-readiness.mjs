import mysql from 'mysql2/promise';
import { mysql2ConnectionOptionsFromUrl } from '../src/lib/db/mysql2-connection-options.ts';
let connection;
const watchdog=setTimeout(()=>{console.error('Registration readiness: timeout.');process.exit(1);},20000);
try {
 if(!process.env.DATABASE_URL)throw Object.assign(new Error(),{code:'DATABASE_NOT_CONFIGURED'});
 connection=await mysql.createConnection(mysql2ConnectionOptionsFromUrl(process.env.DATABASE_URL));
 for(const sql of [
  'SELECT id, email, username, passwordHash, isActive, isApproved, walletAddress, hasTokenAccess, lastLogin FROM marketplace_users WHERE 1 = 0',
  'SELECT id, sessionId, visitorId, path, eventType, source, medium, campaign, referrer, userAgent, metadataJson, createdAt FROM site_analytics_events WHERE 1 = 0'
 ]){const [rows]=await connection.execute({sql,timeout:10000});if(rows.length)throw Object.assign(new Error(),{code:'UNEXPECTED_ROWS'});}
 const [indexes]=await connection.execute({sql:"SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_users' AND NON_UNIQUE = 0",timeout:10000});
 const groups=new Map();for(const row of indexes){const group=groups.get(row.INDEX_NAME)||[];group.push(row.COLUMN_NAME);groups.set(row.INDEX_NAME,group);}
 for(const column of ['email','username'])if(![...groups.values()].some(columns=>columns.length===1&&columns[0]===column))throw Object.assign(new Error(),{code:'UNIQUE_ACCOUNT_INDEX_MISSING'});
 console.log('Registration readiness passed: existing account/event columns and unique account indexes verified. Zero member/event rows read; no writes or schema changes.');
}catch(error){const code=typeof error?.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'CONNECTION_OR_SCHEMA_ERROR';console.error('Registration readiness failed: '+code);process.exitCode=1;}
finally{if(connection)await connection.end().catch(()=>{});clearTimeout(watchdog);}
